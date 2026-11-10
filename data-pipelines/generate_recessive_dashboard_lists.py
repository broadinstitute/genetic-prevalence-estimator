import argparse
import json
import os
import ast
import gc
import time
import signal
import subprocess
import shutil
import glob
from pathlib import Path

from datetime import datetime
import hail as hl
import pandas as pd

from recessive_dashboard.outputs import (
    prepare_dashboard_download,
    serialize_dashboard_models,
    write_recommended_variants_to_csv,
)
from recessive_dashboard.variant_flags_and_frequencies import (
    VARIANT_FLAG_CALCULATION_FIELDS,
    calculate_carrier_frequency_and_prevalence,
    flag_and_filter_variants,
    select_top_ten_variants,
)

GENIE_RECESSIVE_DASHBOARD_INPUT_GENES_LOCAL_FILENAME = (
    "2026-06-12_genie-input_5k-disease-associated-dashboard-genes.csv"
)

GNOMAD_GRCH38_GENES_PATH = "gs://aggregate-frequency-calculator-data/input/genes/gnomAD_browser_genes_grch38_annotated_6.ht"

GNOMAD_V4_VARIANTS_PATH = (
    "gs://aggregate-frequency-calculator-data/gnomAD/gnomAD_v4.1.0_variants.ht"
)


SPARK_CONF = {
    "spark.driver.memory": "16g",
    "spark.executor.memory": "16g",
    "spark.driver.maxResultSize": "8g",
    "spark.memory.fraction": "0.8",
    "spark.memory.storageFraction": "0.3",
    "spark.local.dir": "/tmp",
    "spark.executor.extraJavaOptions": "-XX:+UseG1GC -XX:G1HeapRegionSize=32M",
    "spark.driver.extraJavaOptions": "-XX:+UseG1GC",
    "spark.network.timeout": "800s",
    "spark.executor.heartbeatInterval": "400s",
    "spark.default.parallelism": "8",
    "spark.sql.shuffle.partitions": "8",
    "spark.serializer": "org.apache.spark.serializer.KryoSerializer",
    "spark.kryoserializer.buffer.max": "1g",
}


def init_hail(quiet):
    hl.init(quiet=quiet, master="local[8]", spark_conf=SPARK_CONF)


PLOF_VEP_CONSEQUENCE_TERMS = hl.set(
    [
        "transcript_ablation",
        "splice_acceptor_variant",
        "splice_donor_variant",
        "stop_gained",
        "frameshift_variant",
    ]
)


VARIANT_FIELDS = [
    "id",
    # Consequence
    "hgvsc",
    "hgvsp",
    "lof",
    "major_consequence",
    "gene_id",
    "gene_symbol",
    "transcript_id",
    # Frequency
    "AC",
    "AN",
    "homozygote_count",
    # ClinVar
    "clinvar_variation_id",
    "clinical_significance",
    "gold_stars",
    # Other
    "filters",
    "flags",
    "sample_sets",
    "source",
    # LoF curation
    "lof_curation",
]


def variant_id(locus, alleles):
    return (
        locus.contig.replace("^chr", "")
        + "-"
        + hl.str(locus.position)
        + "-"
        + alleles[0]
        + "-"
        + alleles[1]
    )


# Currently this is used on the first local run to create a checkpointed file,
#   if run in google cloud run, this would be run every time and checkpointing wouldn't
#   be needed
def prepare_gene_models(gnomAD_gene_models_path, base_dir):
    ht = hl.read_table(gnomAD_gene_models_path)

    ht = ht.annotate(
        mane_select_transcript_ensemble_version=ht.mane_select_transcript.ensembl_version
    )

    ht = ht.select(
        #    "gene_id",  we get this for free since the .ht is keyed by it
        "gene_version",
        "interval",
        "chrom",
        "strand",
        "start",
        "stop",
        "xstart",
        "xstop",
        "symbol",
        "name",
        "alias_symbols",
        "symbol_upper_case",
        "preferred_transcript_id",
        "mane_select_transcript_ensemble_version",
    )

    ht = ht.key_by("symbol")

    ht.write(
        os.path.join(base_dir, "processed_data", "reindexed_gene_models.ht"),
        overwrite=True,
    )

    return ht


def _annotate_with_gnomad(contig, start, stop, transcript_id, gnomad_variants):
    ht = hl.filter_intervals(
        gnomad_variants,
        [
            hl.interval(
                hl.locus(contig, start, "GRCh38"),
                hl.locus(contig, stop, "GRCh38"),
                includes_start=True,
                includes_end=True,
            )
        ],
    )

    ht = ht.transmute(
        transcript_consequence=ht.transcript_consequences.find(
            lambda csq: csq.transcript_id == transcript_id
        )
    )

    ht = ht.filter(hl.is_defined(ht.transcript_consequence))
    ht = ht.transmute(**ht.transcript_consequence)

    include_from_gnomad = PLOF_VEP_CONSEQUENCE_TERMS.contains(ht.major_consequence) & (
        ht.lof == "HC"
    )

    ht = ht.annotate(include_from_gnomad=include_from_gnomad)

    return ht


def _annotate_with_clinvar(ht):
    # these should be kept in sync with the classifications in import_clinvar.py
    PATHOGENIC_CLASSIFICATIONS = [
        "Likely pathogenic",
        "Likely pathogenic/Likely risk allele",
        "Likely pathogenic/Pathogenic",
        "Pathogenic",
        "Pathogenic/Pathogenic",
        "Pathogenic/Likely pathogenic",
        "Pathogenic/Likely pathogenic/Likely risk allele",
        "Pathogenic/Likely pathogenic/Pathogenic",
    ]

    pathogenic_significance = (
        ht.clinvar.clinical_significance_category == "pathogenic_or_likely_pathogenic"
    )

    pathogenic_classifications_set = hl.literal(PATHOGENIC_CLASSIFICATIONS)
    primary_report_is_path = hl.if_else(
        pathogenic_classifications_set.contains(ht.clinvar.clinical_significance[0]),
        True,
        False,
    )

    include_from_clinvar = pathogenic_significance & primary_report_is_path

    ht = ht.annotate(include_from_clinvar=include_from_clinvar)

    return ht


def _remove_clinvar_primary_benign_classifications(ht):
    # these should be kept in sync with the classifications in import_clinvar.py
    BENIGN_CLASSIFICATIONS = [
        "Benign",
        "Benign/Likely benign",
        "Likely benign",
    ]

    benign_classifications_set = hl.literal(BENIGN_CLASSIFICATIONS)
    primary_report_is_benign = hl.if_else(
        benign_classifications_set.contains(ht.clinvar.clinical_significance[0]),
        True,
        False,
    )

    ht = ht.annotate(disclude_because_benign=primary_report_is_benign)
    ht = ht.filter(~ht.disclude_because_benign)

    return ht


def collect_gene_variants(
    transcript_id,
    start,
    stop,
    chrom,
    gnomad_variants,
    clinvar_variants,
):
    contig = f"chr{chrom}"

    ht = _annotate_with_gnomad(contig, start, stop, transcript_id, gnomad_variants)

    ht = ht.annotate(clinvar=clinvar_variants[ht.locus, ht.alleles])

    ht = _annotate_with_clinvar(ht)

    ht = ht.filter(ht.include_from_gnomad | ht.include_from_clinvar)

    ht = _remove_clinvar_primary_benign_classifications(ht)

    ht = ht.transmute(
        source=hl.array(
            [
                hl.or_missing(ht.include_from_gnomad, "gnomAD"),
                hl.or_missing(ht.include_from_clinvar, "ClinVar"),
            ]
        ).filter(hl.is_defined)
    )

    ht = ht.annotate(id=variant_id(ht.locus, ht.alleles))

    ht = ht.annotate(**ht.freq.joint)

    ht = ht.transmute(
        **ht.clinvar.select(
            "clinvar_variation_id",
            "clinical_significance",
            "clinical_significance_category",
            "gold_stars",
        )
    )

    ht = ht.annotate(_freq_missing=hl.is_missing(ht.freq))

    # TODO: lof curation for v2, later for v4
    table_fields = set(ht.row)
    select_fields = [field for field in VARIANT_FIELDS if field in table_fields]
    temp_fields_for_flags = [
        field for field in VARIANT_FLAG_CALCULATION_FIELDS if field in table_fields
    ]
    ht = ht.select(*select_fields, *temp_fields_for_flags)

    variants = [json.loads(variant) for variant in hl.json(ht.row_value).collect()]

    del ht
    gc.collect()

    return variants


def annotate_variants_with_orphanet_prevalences(variants, orphanet):
    def format_prevalence(prevalence):
        parts = prevalence.split("/")
        numerator = parts[0].strip()
        denominator = parts[1].strip()
        formatted_denominator = "{:,}".format(
            int(denominator.replace(" ", "").replace(",", ""))
        )
        return f"{numerator} / {formatted_denominator}"

    def extract_prevalences(row):
        row = ast.literal_eval(row)
        prevalences = [prevalence.split(":")[1] for prevalence in row]
        prevalences = [
            "-" if prevalence == "Unknown" else prevalence for prevalence in prevalences
        ]
        if all(value == prevalences[0] for value in prevalences):
            if "/" in prevalences[0]:
                return format_prevalence(prevalences[0])
            return prevalences[0]
        else:
            return "multiple_prevalences"

    orphanet["genetic_prevalence_orphanet"] = orphanet["OrphaPrevalence"].apply(
        extract_prevalences
    )

    orphanet = orphanet.rename(columns={"ENSG_ID": "gene_id"}).drop(
        columns=["OrphaCodes", "OrphaPrevalence", "GeneSymbol"]
    )

    pd.set_option("display.max_columns", None)
    merged_df = pd.merge(variants, orphanet, on="gene_id", how="left")
    return merged_df


def prepare_dashboard_gene_results(
    df_genes_this_batch,
    base_dir,
    gnomad_variants_path,
):
    ht_gnomad_variants = hl.read_table(gnomad_variants_path)
    metadata_populations = hl.eval(ht_gnomad_variants.globals.populations)

    CLINVAR_GRCH38_PATH = os.path.join(
        base_dir, "processed_data", "ClinVar", "ClinVar_GRCh38_variants.ht"
    )
    ht_clinvar_variants = hl.read_table(CLINVAR_GRCH38_PATH)
    metadata_clinvar_version = hl.eval(ht_clinvar_variants.globals.release_date)

    ORPHANET_PATH = os.path.join(base_dir, "processed_data", "orphanet_prevalences.tsv")
    df_orphanet_prevalences = pd.read_csv(ORPHANET_PATH, sep="\t")
    gene_results = []

    batch_i = 0

    def subset_gnomad_and_clinvar_to_chrom(chrom, start, stop):
        print(f"    -- Subsetting Hail tables...")
        region_interval = hl.locus_interval(
            f"chr{chrom}",
            start,
            stop,
            includes_start=True,
            includes_end=True,
            reference_genome="GRCh38",
        )

        chrom_gnomad_variants = hl.filter_intervals(
            ht_gnomad_variants, [region_interval]
        )
        chrom_clinvar_variants = hl.filter_intervals(
            ht_clinvar_variants, [region_interval]
        )

        return (chrom_gnomad_variants, chrom_clinvar_variants)

    # ---

    batch_chrom_list = df_genes_this_batch["chrom"].values
    if len(set(batch_chrom_list)) > 1:
        print("!!=== Panic! Multiple chroms in this batch!")
        print("!!=== Exiting early")
        exit(1)

    batch_chrom = batch_chrom_list[0]
    batch_pos_min = df_genes_this_batch["start"].values.min()
    batch_pos_max = df_genes_this_batch["stop"].values.max()

    subset_start_time = datetime.now()

    (
        chrom_gnomad_variants,
        chrom_clinvar_variants,
    ) = subset_gnomad_and_clinvar_to_chrom(batch_chrom, batch_pos_min, batch_pos_max)
    chrom_gnomad_variants = chrom_gnomad_variants.persist()
    chrom_clinvar_variants = chrom_clinvar_variants.persist()

    subset_end_time = datetime.now()
    duration_seconds = (subset_end_time - subset_start_time).total_seconds()
    minutes, seconds = divmod(int(duration_seconds), 60)
    formatted_time = f"{minutes:02d}m{seconds:02d}s"
    print(f"    - Finished in {formatted_time}")

    # ---

    for index, row in df_genes_this_batch.iterrows():
        single_gene_start_time = datetime.now()
        batch_i += 1
        print(
            f"  -- Processing row {index + 1} [{row.symbol}, chr{row.chrom} - {row.gene_id}] ({batch_i} of {len(df_genes_this_batch)} in batch) ({row.type})"
        )

        gene_id_with_version = f"{row.gene_id}.{row.gene_version}"

        mane_select_transcript_version_val = row.mane_select_transcript_ensemble_version

        safe_mane_select_transcript_ensembl_version = (
            0
            if pd.isna(mane_select_transcript_version_val)
            else row.mane_select_transcript_ensemble_version
        )

        if safe_mane_select_transcript_ensembl_version == 0:
            print(
                f"   - Row has {row.mane_select_transcript_ensemble_version} for transcript version! Using fallback of {safe_mane_select_transcript_ensembl_version}"
            )

        transcript_id_with_version = f"{row.preferred_transcript_id}.{safe_mane_select_transcript_ensembl_version}"

        notes = f"This list was algorithmically generated for the gene {row.symbol}, with the transcript {row.preferred_transcript_id}"
        date_created = datetime.now().isoformat()

        metadata = {
            "gnomad_version": "4.1.1",
            "reference_genome": "GRCh38",
            "gene_symbol": row.symbol,
            "populations": metadata_populations,
            "clinvar_version": metadata_clinvar_version,
            "gene_id": gene_id_with_version,
            "transcript_id": transcript_id_with_version,
            "include_gnomad_plof": True,
            "include_clinvar_clinical_significance": [
                "pathogenic_or_likely_pathogenic"
            ],
            "include_gnomad_missense_with_high_revel_score": False,
        }

        collected_variants = collect_gene_variants(
            transcript_id=transcript_id_with_version,
            start=row.start,
            stop=row.stop,
            chrom=row.chrom,
            gnomad_variants=chrom_gnomad_variants,
            clinvar_variants=chrom_clinvar_variants,
        )

        recommended_variants = flag_and_filter_variants(collected_variants)
        top_ten_variants = select_top_ten_variants(recommended_variants)

        write_recommended_variants_to_csv(
            base_dir, row.symbol, row.gene_id, recommended_variants
        )

        calculations = calculate_carrier_frequency_and_prevalence(
            recommended_variants, metadata_populations
        )
        gene_results.append(
            {
                "gene_id": row.gene_id,
                "label": f"{row.symbol} - Dashboard",
                "notes": notes,
                "date_created": date_created,
                "metadata": metadata,
                "variant_calculations": calculations,
                "top_ten_variants": top_ten_variants,
                "genetic_prevalence_genereviews": "",
                "genetic_prevalence_other": "",
                "genetic_incidence_other": "",
                "type": row.type,
            }
        )

        single_gene_end_time = datetime.now()
        duration_seconds = (
            single_gene_end_time - single_gene_start_time
        ).total_seconds()
        minutes, seconds = divmod(int(duration_seconds), 60)
        formatted_time = f"{minutes:02d}m{seconds:02d}s"
        print(f"    - Finished in {formatted_time}")

    gene_results_frame = pd.DataFrame(gene_results)
    gene_results_frame = annotate_variants_with_orphanet_prevalences(
        gene_results_frame, df_orphanet_prevalences
    )

    chrom_gnomad_variants.unpersist()
    chrom_clinvar_variants.unpersist()

    return gene_results_frame


def safe_cleanup():
    """
    Since this pipeline exits and re-initializes Hail, here we manually trigger GC
    and clear out specific spark processes, and hail/spark temp directories,
    that may still be hanging around. Without this, subsequent batches get slower and slower
    e.g. on the initial write of this pipeline, going from ~10 mins per batch, to 45+ minutes.
    """
    gc.collect()

    try:
        hl.stop()
    except Exception:
        pass

    time.sleep(2)

    try:
        cmd = "ps aux | grep '[j]ava' | grep -E 'spark|hail' | awk '{print $2}'"
        pids = subprocess.check_output(cmd, shell=True).decode().strip()

        if pids:
            for pid in pids.split("\n"):
                if pid:
                    try:
                        os.kill(int(pid), signal.SIGKILL)
                    except OSError:
                        pass
    except Exception as e:
        pass

    try:
        temp_patterns = ["/tmp/hail*", "/tmp/spark*", "/tmp/blockmgr-*"]
        for pattern in temp_patterns:
            for path in glob.glob(pattern):
                try:
                    if os.path.isdir(path):
                        shutil.rmtree(path)
                    else:
                        os.remove(path)
                except Exception:
                    pass
    except Exception:
        pass

    time.sleep(1)


def prepare_and_batch_genes(
    input_genes_csv_fullpath,
    gene_models_ht_path,
    batch_size,
):
    ds = hl.import_table(
        input_genes_csv_fullpath,
        delimiter=",",
        quote='"',
        key="symbol",
        impute=True,
    )

    # TK: possibly match on prior/alias symbols from gencode here
    #   currently, about 15 genes get dropped in this step
    ht_gnomad_gene_models = hl.read_table(gene_models_ht_path)
    ds = ds.annotate(**ht_gnomad_gene_models[ds.symbol])

    df = ds.to_pandas()
    print(f"  - {len(df)} -- Start")

    df = df.dropna(subset=["gene_id", "chrom", "start", "stop"])
    print(f"  - {len(df)} -- Post initial null drop on gene_id, chrom, start, stop")

    df["chrom"] = df["chrom"].astype(str).str.replace("^chr", "", regex=True)
    df["start"] = pd.to_numeric(df["start"], errors="coerce")
    df["stop"] = pd.to_numeric(df["stop"], errors="coerce")
    df = df.dropna(subset=["chrom", "start", "stop"])
    print(f"  - {len(df)} -- Post coersion of chrom, start, stop then dropna")

    def chrom_key(c):
        if c == "X":
            return 23
        if c == "Y":
            return 24
        if c in ("M", "MT"):
            return 25
        try:
            return int(c)
        except:
            return 99

    df["chrom_sort"] = df["chrom"].apply(chrom_key)

    df = (
        df.sort_values(by=["chrom_sort", "start"])
        .drop(columns=["chrom_sort"])
        .reset_index(drop=True)
    )

    batch_counter = 0
    batch_ids = []

    for _chrom, group in df.groupby("chrom", sort=False):
        for i in range(0, len(group), batch_size):
            chunk_len = len(group.iloc[i : i + batch_size])
            batch_ids.extend([batch_counter] * chunk_len)
            batch_counter += 1

    df["batch_id"] = batch_ids

    return df


# e.g.
# uv run python data-pipelines/generate_recessive_dashboard_lists.py \
#     --input-genes-file=2026-05-29_genie-input_5k-disease-associated-genes.csv \
#     --test
def main() -> None:
    start_time = datetime.now()

    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", required=False)
    parser.add_argument("--directory-root", required=False)
    parser.add_argument("--input-genes-file", required=False)
    parser.add_argument("--test", action="store_true", required=False)
    parser.add_argument("--gnomad-variants-path", default=GNOMAD_V4_VARIANTS_PATH)
    args = parser.parse_args()

    base_dir = os.path.join(os.path.dirname(__file__), "../data")
    if args.directory_root:
        base_dir = args.directory_root

    input_genes_filename = GENIE_RECESSIVE_DASHBOARD_INPUT_GENES_LOCAL_FILENAME
    if args.input_genes_file:
        input_genes_filename = args.input_genes_file

    input_genes_csv_fullpath = os.path.join(base_dir, "input", input_genes_filename)

    # 310 is a funny number, but at 300, chromosome 11 had 2 batches:
    # - first batch of 300
    # - second batch of 1
    # use 310 to reduce total batches by 1 for convenience
    BATCH_SIZE = 310

    file_prefix = ""

    # ---

    print(f"\nRunning with input file: {input_genes_csv_fullpath}\n")

    print("Initializing Hail for global data prep...")
    init_hail(quiet=args.quiet)

    gene_models_ht_fullpath = os.path.join(
        base_dir, "processed_data", "reindexed_gene_models.ht"
    )
    if not os.path.exists(gene_models_ht_fullpath):
        prepare_gene_models(GNOMAD_GRCH38_GENES_PATH, base_dir)

    print("Sorting and batching genes...")
    df_genes_batched = prepare_and_batch_genes(
        input_genes_csv_fullpath,
        gene_models_ht_fullpath,
        batch_size=BATCH_SIZE,
    )

    print("\n--- Batch Summary ---")
    batch_summary = df_genes_batched.groupby("batch_id").agg(
        chrom=("chrom", "first"),
        num_genes=("symbol", "count"),
    )

    for batch_id, row in batch_summary.iterrows():
        print(
            f"Batch {batch_id:03d} | chr{row['chrom']:<2} | Genes: {row['num_genes']}"
        )
    print(f"Total Batches: {len(batch_summary)}")
    print("---------------------\n")

    num_batches = df_genes_batched["batch_id"].max() + 1
    print(f"Successfully sorted genes into {num_batches} distinct batches.")

    TEST_GENE_AMOUNT = 20
    if args.test:
        print("Got test arg, moving to single batch of 20 ...")
        df_genes_batched = df_genes_batched.iloc[0:TEST_GENE_AMOUNT]
        df_genes_batched["batch_id"] = 0
        file_prefix = "test_"
        num_batches = 1

    for batch_id in range(num_batches):
        try:
            print("starting cleanup")
            safe_cleanup()

            print("initializing hail")
            init_hail(quiet=args.quiet)

            batch_start_time = datetime.now()

            df_genes_this_batch = df_genes_batched[
                df_genes_batched["batch_id"] == batch_id
            ].copy()
            batch_length = len(df_genes_this_batch)

            print(f"\nBeginning batch_id: {batch_id}, size: {batch_length}")

            print("Preparing dashboard list models ...")

            gene_results = prepare_dashboard_gene_results(
                df_genes_this_batch, base_dir, args.gnomad_variants_path
            )
            df_dashboard_models = serialize_dashboard_models(gene_results)
            model_output_file = (
                Path(base_dir)
                / "output"
                / "recessive_dashboard"
                / "models"
                / f"{file_prefix}recessive_dashboard_models_batch-{batch_id + 1}-of-{num_batches}--{batch_length}-lists.csv"
            )
            model_output_file.parent.mkdir(parents=True, exist_ok=True)
            df_dashboard_models.to_csv(model_output_file, index=False)
            print("\n\nWrote dashboard list models to file")

            # ---

            print("Preparing dashboard list downloads")
            df_dashboard_download = prepare_dashboard_download(gene_results)
            download_output_file = (
                Path(base_dir)
                / "output"
                / "recessive_dashboard"
                / "downloads"
                / f"{file_prefix}recessive_dashboard_downloads_batch-{batch_id + 1}-of-{num_batches}--{batch_length}-lists.csv"
            )
            download_output_file.parent.mkdir(parents=True, exist_ok=True)
            df_dashboard_download.to_csv(download_output_file, index=False)
            print("Wrote dashboard downloads to file")

            # ---

            batch_end_time = datetime.now()
            print(f"Finished batch at: {batch_end_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"It took: {batch_end_time - batch_start_time}\n\n")

            if args.test:
                break

        finally:
            safe_cleanup()

    end_time = datetime.now()
    print(f"Finished at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"It took: {end_time - start_time}")


if __name__ == "__main__":
    main()
