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

GENIE_RECESSIVE_DASHBOARD_INPUT_GENES_PATH = "gs://aggregate-frequency-calculator-data/input/2026-05-29_genie-input_5k-disease-associated-genes.csv"

GNOMAD_GRCH38_GENES_PATH = "gs://aggregate-frequency-calculator-data/input/genes/gnomAD_browser_genes_grch38_annotated_6.ht"


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


def _add_flags_to_variants(ds, max_af_of_clinvar_path_or_likely_path_variants):
    return hl.array(
        [
            hl.or_missing(hl.is_missing(ds.freq), "not_found"),
            hl.or_missing(
                hl.len(
                    hl.or_else(ds.filters.exome, hl.empty_set(hl.tstr)).union(
                        hl.or_else(ds.filters.genome, hl.empty_set(hl.tstr))
                    )
                )
                > 0,
                "filtered",
            ),
            hl.or_missing(
                (ds.AC[0] / ds.AN[0] > max_af_of_clinvar_path_or_likely_path_variants)
                & (hl.is_missing(ds.clinvar_variation_id)),
                "high_AF",
            ),
            # TODO: add "low_AN" flag?
            hl.or_missing(ds.homozygote_count[0] > 0, "has_homozygotes"),
        ]
    ).filter(hl.is_defined)


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


def get_highest_frequency_variants(ds, num_to_keep):
    ds = ds.filter(ds.AN[0] == 0, keep=False)
    ds = ds.order_by(hl.desc(ds.AC[0] / ds.AN[0]))
    ds = ds.head(num_to_keep)

    return ds


def _annotate_with_gnomad(contig, start, stop, transcript_id, gnomad_variants):
    if start is not None and stop is not None:
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

    else:
        ht = ht.filter(ht.locus.contig == contig)

    ht.transmute(
        freq=hl.struct(
            exome=ht.freq[f"exome"],
            genome=ht.freq[f"genome"],
            joint=ht.freq["joint"],
        )
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


def _annotate_with_clinvar(ht, clinvar_variants):
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
        clinvar_variants[ht.locus, ht.alleles].clinical_significance_category
        == "pathogenic_or_likely_pathogenic"
    )

    pathogenic_classifications_set = hl.literal(PATHOGENIC_CLASSIFICATIONS)
    primary_report_is_path = hl.if_else(
        pathogenic_classifications_set.contains(
            clinvar_variants[ht.locus, ht.alleles].clinical_significance[0]
        ),
        True,
        False,
    )

    include_from_clinvar = pathogenic_significance & primary_report_is_path

    ht = ht.annotate(include_from_clinvar=include_from_clinvar)

    return ht


def _remove_clinvar_primary_benign_classifications(ht, clinvar_variants):
    # these should be kept in sync with the classifications in import_clinvar.py
    BENIGN_CLASSIFICATIONS = [
        "Benign",
        "Benign/Likely benign",
        "Likely benign",
    ]

    benign_classifications_set = hl.literal(BENIGN_CLASSIFICATIONS)
    primary_report_is_benign = hl.if_else(
        benign_classifications_set.contains(
            clinvar_variants[ht.locus, ht.alleles].clinical_significance[0]
        ),
        True,
        False,
    )

    ht = ht.annotate(disclude_because_benign=primary_report_is_benign)
    ht = ht.filter(~ht.disclude_because_benign)

    return ht


def _annotate_variants_with_flags(ht):
    max_af_of_clinvar_path_or_likely_path_variants = ht.aggregate(
        hl.agg.filter(
            ht.clinical_significance_category == "pathogenic_or_likely_pathogenic",
            hl.agg.max(ht.AC[0] / ht.AN[0]),
        )
    )

    # if there are no clinvar path or likely path variants, the aggregation returns None
    # explicitly check for this None and substitute 1.1 to ensure nothing can get this flag
    max_af_of_clinvar_path_or_likely_path_variants = (
        max_af_of_clinvar_path_or_likely_path_variants
        if max_af_of_clinvar_path_or_likely_path_variants is not None
        else hl.int(1.1)
    )

    ht = ht.annotate(
        flags=_add_flags_to_variants(ht, max_af_of_clinvar_path_or_likely_path_variants)
    )

    return ht


def process_dashboard_list(
    dataframe,
    index,
    transcript_id,
    start,
    stop,
    chrom,
    gnomad_variants,
    clinvar_variants,
):
    contig = f"chr{chrom}"

    ht = _annotate_with_gnomad(contig, start, stop, transcript_id, gnomad_variants)

    ht = _annotate_with_clinvar(ht, clinvar_variants)

    ht = ht.filter(ht.include_from_gnomad | ht.include_from_clinvar)

    ht = _remove_clinvar_primary_benign_classifications(ht, clinvar_variants)

    ht = ht.transmute(
        source=hl.array(
            [
                hl.or_missing(ht.include_from_gnomad, "gnomAD"),
                hl.or_missing(ht.include_from_clinvar, "ClinVar"),
            ]
        ).filter(hl.is_defined)
    )
    ht = ht.select("source")

    ht = ht.annotate(id=variant_id(ht.locus, ht.alleles))

    ht = ht.annotate(**gnomad_variants[ht.locus, ht.alleles])

    ht = ht.transmute(
        transcript_consequence=ht.transcript_consequences.find(
            lambda csq: csq.transcript_id == transcript_id
        )
    )

    ht = ht.transmute(**ht.transcript_consequence)

    ht = ht.annotate(**ht.freq.joint)

    ht = ht.annotate(
        **clinvar_variants[ht.locus, ht.alleles].select(
            "clinvar_variation_id",
            "clinical_significance",
            "clinical_significance_category",
            "gold_stars",
        )
    )

    ht = _annotate_variants_with_flags(ht)

    ht = ht.filter(~ht.flags.contains("filtered"))

    # TODO: lof curation for v2, later for v4
    table_fields = set(ht.row)
    select_fields = [field for field in VARIANT_FIELDS if field in table_fields]
    ht = ht.select(*select_fields)

    variants = [json.loads(variant) for variant in hl.json(ht.row_value).collect()]

    valid_variants = [
        v
        for v in variants
        if v.get("AN")
        and len(v["AN"]) > 0
        and v["AN"][0] > 0
        and v.get("AC")
        and len(v["AC"]) > 0
    ]

    sorted_variants = sorted(
        valid_variants, key=lambda v: v["AC"][0] / v["AN"][0], reverse=True
    )

    top_10_variants_list = sorted_variants[:10]
    dataframe.at[index, "top_ten_variants"] = json.dumps(top_10_variants_list)

    del ht
    gc.collect()

    return variants


def calculate_carrier_frequency_and_prevalence(variants, populations):
    variant_count = len(variants)
    if variant_count == 0:
        print("For this gene, variants length is 0")

    # calculate sum of allele frequencies across all variants
    total_allele_frequencies = [0] * (len(populations) + 1)
    multiplied_allele_frequencies = [1] * (len(populations) + 1)

    for variant in variants:
        allele_frequencies = []
        if variant["AC"]:
            for index_ac, allele_count in enumerate(variant["AC"]):
                allele_number = variant["AN"][index_ac]
                allele_frequency = (
                    0 if allele_number == 0 else allele_count / allele_number
                )
                allele_frequencies.append(allele_frequency)
                total_allele_frequencies[index_ac] = (
                    total_allele_frequencies[index_ac] + allele_frequency
                )
                multiplied_allele_frequencies[index_ac] = multiplied_allele_frequencies[
                    index_ac
                ] * (1 - allele_frequency)

    # calculate total summary frequency and prevalence
    carrier_frequency_array = []
    carrier_frequency_simplified_array = []
    prevalence_array = []
    for q in total_allele_frequencies:
        carrier_frequency = 2 * (1 - q) * q
        carrier_frequency_array.append(carrier_frequency)

        carrier_frequency_simplified = 2 * q
        carrier_frequency_simplified_array.append(carrier_frequency_simplified)

        prevalence = q**2
        prevalence_array.append(prevalence)

    # TODO: combine these two into one after tests pass?
    total_allele_counts_and_numbers = [
        {"AC": 0, "AN": 0} for _ in range(len(populations) + 1)
    ]
    for variant in variants:
        for index_ac, allele_count in enumerate(variant["AC"]):
            allele_number = variant["AN"][index_ac]
            total_allele_counts_and_numbers[index_ac]["AC"] += allele_count
            total_allele_counts_and_numbers[index_ac]["AN"] += allele_number

    length = len(variants)
    carrier_frequency_raw_numbers_array = []
    for ac_an in total_allele_counts_and_numbers:
        carrier_frequency_raw_numbers = {
            "total_ac": ac_an["AC"],
            "average_an": (ac_an["AN"] / length) if length > 0 else 0,
        }
        carrier_frequency_raw_numbers_array.append(carrier_frequency_raw_numbers)

    prevalence_bayesian_array = []
    for q in multiplied_allele_frequencies:
        prevalence_bayesian = (1 - q) ** 2
        prevalence_bayesian_array.append(prevalence_bayesian)

    calculations_object = {
        "variant_count": variant_count,
        "prevalence": prevalence_array,
        "prevalence_bayesian": prevalence_bayesian_array,
        "total_allele_frequency": total_allele_frequencies,
        "carrier_frequency": carrier_frequency_array,
        "carrier_frequency_simplified": carrier_frequency_simplified_array,
        "carrier_frequency_raw_numbers": carrier_frequency_raw_numbers_array,
    }

    return calculations_object


def calculate_stats(dataframe, index, variants, populations):
    stats_dict = calculate_carrier_frequency_and_prevalence(variants, populations)
    dataframe.at[index, "variant_calculations"] = json.dumps(stats_dict)


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


def write_recommended_variants_to_csv(
    base_dir, gene_symbol, gene_id, recommended_variants
):
    filename = f"GeniE_dashboard_variants-{gene_symbol}-{gene_id}.csv"

    def format_dict(title, list):
        ancestry_groups = [
            "global",
            "african_african_american",
            "admixed_american",
            "ashkenazi_jewish",
            "east_asian",
            "european_finnish",
            "remaining",
            "south_asian",
        ]

        obj = {}
        for i, ancestry_group in enumerate(ancestry_groups):
            name = f"{title}_{ancestry_group}"
            value = list[i]
            obj[name] = value

        return obj

    def format_af_dict(title, list1, list2):
        ancestry_groups = [
            "global",
            "african_african_american",
            "admixed_american",
            "ashkenazi_jewish",
            "east_asian",
            "european_finnish",
            "remaining",
            "south_asian",
        ]

        obj = {}
        for i, ancestry_group in enumerate(ancestry_groups):
            name = f"{title}_{ancestry_group}"
            ac = list1[i]
            an = list2[i]
            value = ac / an
            obj[name] = value

        return obj

    formatted_variants = []
    for variant in recommended_variants:
        formatted_variants.append(
            {
                "gene_symbol": gene_symbol,
                "gene_id": gene_id,
                "variant_gnomad_id": variant["id"],
                #
                "vep_consequence": variant["major_consequence"],
                "hgvsc": variant["hgvsc"],
                "hgvsp": variant["hgvsp"],
                "loftee": variant["lof"],
                "clinvar_clinical_significance": variant["clinical_significance"][0]
                if variant["clinical_significance"]
                else None,
                "clinvar_variation_id": variant["clinvar_variation_id"],
                #
                "allele_count": variant["AC"][0] if variant["AC"] else None,
                "allele_number": variant["AN"][0] if variant["AN"] else None,
                "allele_frequency": (variant["AC"][0] / variant["AN"][0])
                if (variant["AC"] and variant["AN"])
                else None,
                "homozygote_count": variant["homozygote_count"][0]
                if variant["homozygote_count"]
                else None,
                #
                "flags": "|".join(variant["flags"]),
                "source": "|".join(variant["source"]),
                #
                "allele_count_per_ancestry": format_dict("allele_count", variant["AC"])
                if variant["AC"]
                else None,
                "allele_number_per_ancestry": format_dict(
                    "allele_number", variant["AN"]
                )
                if variant["AN"]
                else None,
                "allele_frequency_per_ancestry": format_af_dict(
                    "allele_frequency", variant["AC"], variant["AN"]
                )
                if (variant["AC"] and variant["AN"])
                else None,
                "homozygote_count_per_ancestry": format_dict(
                    "homozygote_count", variant["homozygote_count"]
                )
                if variant["homozygote_count"]
                else None,
            }
        )

    df = pd.DataFrame(formatted_variants)

    filename = f"GeniE_dashboard_variants-{gene_symbol}-{gene_id}.csv"
    output_dir = os.path.join(
        base_dir,
        "output",
        "dashboard",
        "individual_gene_files",
    )
    full_output_path = os.path.join(output_dir, filename)

    os.makedirs(output_dir, exist_ok=True)
    df.to_csv(full_output_path, index=False)
    print(f"    - Gene-variant CSV file written to ...{filename}")


def prepare_dashboard_lists(
    df_genes_this_batch,
    base_dir,
):
    GNOMAD_V4_VARIANTS_PATH = (
        "gs://aggregate-frequency-calculator-data/gnomAD/gnomAD_v4.1.0_variants.ht"
    )
    ht_gnomad_variants = hl.read_table(GNOMAD_V4_VARIANTS_PATH)
    metadata_populations = hl.eval(ht_gnomad_variants.globals.populations)

    CLINVAR_GRCH38_PATH = os.path.join(
        base_dir, "processed_data", "ClinVar", "ClinVar_GRCh38_variants.ht"
    )
    ht_clinvar_variants = hl.read_table(CLINVAR_GRCH38_PATH)
    metadata_clinvar_version = hl.eval(ht_clinvar_variants.globals.release_date)

    df = df_genes_this_batch

    df["variants"] = [[] for _ in range(len(df))]
    df["top_ten_variants"] = [[] for _ in range(len(df))]
    df["label"] = ""
    df["notes"] = ""
    df["metadata"] = None
    current_datetime = datetime.now()
    iso_8601_datetime = current_datetime.isoformat()
    df["date_created"] = iso_8601_datetime
    df["variant_calculations"] = [{} for _ in range(len(df))]

    ORPHANET_PATH = os.path.join(base_dir, "processed_data", "orphanet_prevalences.tsv")
    df_orphanet_prevalences = pd.read_csv(ORPHANET_PATH, sep="\t")
    ds = annotate_variants_with_orphanet_prevalences(df, df_orphanet_prevalences)
    df["genetic_prevalence_genereviews"] = ""
    df["genetic_prevalence_other"] = ""
    df["genetic_incidence_other"] = ""

    df["inheritance_type"] = ""

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

    batch_chrom_list = df["chrom"].values
    if len(set(batch_chrom_list)) > 1:
        print("!!=== Panic! Multiple chroms in this batch!")
        print("!!=== Exiting early")
        exit(1)

    batch_chrom = batch_chrom_list[0]
    batch_pos_min = df["start"].values.min()
    batch_pos_max = df["stop"].values.max()

    subset_start_time = datetime.now()

    (
        chrom_gnomad_variants,
        chrom_clinvar_variants,
    ) = subset_gnomad_and_clinvar_to_chrom(batch_chrom, batch_pos_min, batch_pos_max)
    chrom_gnomad_variants = chrom_gnomad_variants.persist()
    chrom_clinvar_variants = chrom_clinvar_variants.persist()

    subset_end_time = datetime.now()
    duration_seconds = (subset_start_time - subset_end_time).total_seconds()
    minutes, seconds = divmod(int(duration_seconds), 60)
    formatted_time = f"{minutes:02d}m{seconds:02d}s"
    print(f"    - Finished in {formatted_time}")

    # ---

    for index, row in df.iterrows():
        single_gene_start_time = datetime.now()
        batch_i += 1
        print(
            f"  -- Processing row {index + 1} [{row.symbol}, chr{row.chrom} - {row.gene_id}] ({batch_i} of {len(df)} in batch) ({row.type})"
        )

        gene_id_with_version = f"{row.gene_id}.{row.gene_version}"
        transcript_id_with_version = f"{row.preferred_transcript_id}.{row.mane_select_transcript_ensemble_version}"

        df.at[index, "label"] = f"{row.symbol} - Dashboard"
        df.at[
            index, "notes"
        ] = f"This list was algorithmically generated for the gene {row.symbol}, with the transcript {row.preferred_transcript_id}"

        current_datetime = datetime.now()
        iso_8601_datetime = current_datetime.isoformat()
        df.at[index, "date_created"] = iso_8601_datetime

        df.at[index, "inheritance_type"] = row.type

        metadata = {
            "gnomad_version": "4.1.0",
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

        df.at[index, "metadata"] = json.dumps(metadata)

        if row.should_calculate_recessive == False:
            print(f"    -- Skipping row, not reccessive or semidominant! ({row.type})")
            continue

        recommended_variants = process_dashboard_list(
            dataframe=df,
            index=index,
            transcript_id=transcript_id_with_version,
            start=row.start,
            stop=row.stop,
            chrom=row.chrom,
            gnomad_variants=chrom_gnomad_variants,
            clinvar_variants=chrom_clinvar_variants,
        )

        # TODO: right here, call a helper to create a .csv for this variant
        write_recommended_variants_to_csv(
            base_dir, row.symbol, row.gene_id, recommended_variants
        )

        calculate_stats(
            dataframe=df,
            index=index,
            populations=metadata_populations,
            variants=recommended_variants,
        )

        single_gene_end_time = datetime.now()
        duration_seconds = (
            single_gene_end_time - single_gene_start_time
        ).total_seconds()
        minutes, seconds = divmod(int(duration_seconds), 60)
        formatted_time = f"{minutes:02d}m{seconds:02d}s"
        print(f"    - Finished in {formatted_time}")

    df = annotate_variants_with_orphanet_prevalences(df, df_orphanet_prevalences)

    FINAL_COLUMNS = [
        "gene_id",
        "label",
        "notes",
        "date_created",
        "metadata",
        "variant_calculations",
        "top_ten_variants",
        "genetic_prevalence_orphanet",
        "genetic_prevalence_genereviews",
        "genetic_prevalence_other",
        "genetic_incidence_other",
        "type",
    ]
    df = df[FINAL_COLUMNS]

    chrom_gnomad_variants.unpersist()
    chrom_clinvar_variants.unpersist()

    return df


def safe_json_load(val, fallback=None):
    if isinstance(val, dict):
        return val
    try:
        return json.loads(val)
    except:
        return fallback if fallback is not None else {}


def prepare_dashboard_download(base_dir, df_recessive):
    V4_ANCESTRY_GROUPS = [
        "total",
        "african_african_american",
        "admixed_american",
        "ashkenazi_jewish",
        "east_asian",
        "european_finnish",
        "middle_eastern",
        "european_non_finnish",
        "remaining",
        "south_asian",
    ]

    GRP_STRATIFIED_FIELDS = [
        {
            "calculations_dict_name": "total_allele_frequency",
            "downloads_column_name": "allele_frequency",
        },
        {
            "calculations_dict_name": "carrier_frequency",
            "downloads_column_name": "carrier_frequency",
        },
        {
            "calculations_dict_name": "prevalence",
            "downloads_column_name": "genetic_prevalence",
        },
    ]

    def generate_ancestry_columns(fields_to_stratify, ancestry_groups):
        return [
            f"{field['downloads_column_name']}_{ancestry}"
            for field in fields_to_stratify
            for ancestry in ancestry_groups
        ]

    TOP_TEN_VARIANT_COLUMNS = [
        "gnomad_id",
        "vep_consequence",
        "hgvsc",
        "hgvsp",
        "loftee",
        "clinvar_clinical_significance",
        "clinvar_variation_id",
        "allele_count",
        "allele_number",
        "allele_frequency",
        "source",
        "flags",
    ]

    def generate_top_ten_variant_columns(top_ten_variant_fields):
        return [
            f"variant_{i+1}_{field}"
            for i in range(10)
            for field in top_ten_variant_fields
        ]

    def stratify_fields_by_ancestry(calculations, fields_with_ancestries):
        result = {}
        for field in fields_with_ancestries:
            values = calculations.get(
                field["calculations_dict_name"], [0] * len(V4_ANCESTRY_GROUPS)
            )
            for i, ancestry in enumerate(V4_ANCESTRY_GROUPS):
                result[f"{field['downloads_column_name']}_{ancestry}"] = values[i]
        return result

    def build_top_ten_variant_data(top_ten_variants):
        top_ten_variant_data = {}

        for i, variant in enumerate(top_ten_variants):
            prefix = f"variant_{i + 1}"
            allele_count = variant["AC"][0]
            allele_number = variant["AN"][0]

            formatted_variant_data = {
                f"{prefix}_gnomad_id": variant["id"],
                f"{prefix}_vep_consequence": variant["major_consequence"],
                f"{prefix}_hgvsc": variant["hgvsc"],
                f"{prefix}_hgvsp": variant["hgvsp"],
                f"{prefix}_loftee": variant["lof"],
                f"{prefix}_clinvar_clinical_significance": (
                    variant["clinical_significance"][0]
                    if variant["clinical_significance"]
                    else None
                ),
                f"{prefix}_clinvar_variation_id": variant["clinvar_variation_id"],
                f"{prefix}_allele_count": int(allele_count),
                f"{prefix}_allele_number": int(allele_number),
                f"{prefix}_allele_frequency": (
                    0
                    if allele_count == 0
                    else "{:.2e}".format(allele_count / allele_number)
                ),
                f"{prefix}_source": ", ".join(variant["source"]),
                f"{prefix}_flags": ", ".join(variant["flags"]),
            }

            top_ten_variant_data.update(formatted_variant_data)

        return top_ten_variant_data

    def build_base_columns():
        base_columns = [
            "gene_symbol",
            "transcript_id",
            "gnomad_version",
            "reference_genome",
            "included_clinvar_variants",
            "clinvar_version",
            "date_created",
            "oe_missense_prior",
            "oe_missense_gene",
            "MU_mis",
            "oe_lof_prior",
            "oe_lof_gene",
            "MU_lof",
            "Estimated incidence of de novo variation",
            "Estimated incidence of de novo variation (per 100,000)",
            "# of P, LP and HC pLoF variants in gnomAD",
        ]

        ancestry_stratified_columns = generate_ancestry_columns(
            GRP_STRATIFIED_FIELDS, V4_ANCESTRY_GROUPS
        )
        top_ten_variant_columns = generate_top_ten_variant_columns(
            TOP_TEN_VARIANT_COLUMNS
        )

        return base_columns + ancestry_stratified_columns + top_ten_variant_columns

    download_data = []

    for _, row in df_recessive.iterrows():
        metadata = safe_json_load(row.get("metadata"))

        calculations = safe_json_load(row.get("variant_calculations"), {})
        top_ten_variants = safe_json_load(row.get("top_ten_variants"), [])

        # prepare a temporary dictionary for all the data in this row to avoid repeated small insertions fragmenting the dataframe
        row_data = {
            "gene_symbol": metadata.get("gene_symbol", row.get("gene_id_base")),
            "transcript_id": metadata["transcript_id"],
            "gnomad_version": metadata["gnomad_version"],
            "reference_genome": metadata["reference_genome"],
            "# of P, LP and HC pLoF variants in gnomAD": calculations.get(
                "variant_count"
            ),
            "included_clinvar_variants": ", ".join(
                metadata.get("include_clinvar_clinical_significance", [])
            ),
            "clinvar_version": metadata.get("clinvar_version", ""),
            "date_created": row["date_created"],
        }

        row_data.update(
            stratify_fields_by_ancestry(calculations, GRP_STRATIFIED_FIELDS)
        )
        row_data.update(build_top_ten_variant_data(top_ten_variants))
        download_data.append(row_data)

    df_download = pd.DataFrame(download_data)

    final_column_order = build_base_columns()

    for col in final_column_order:
        if col not in df_download.columns:
            df_download[col] = None

    df_download = df_download[final_column_order]

    return df_download


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


def assign_contiguous_batches(genes_df, batch_size=100):
    # Ensure coordinates are clean integers
    genes_df["chrom"] = genes_df["chrom"].astype(str).str.replace("chr", "")
    genes_df["start"] = pd.to_numeric(genes_df["start"], errors="coerce")
    genes_df["stop"] = pd.to_numeric(genes_df["stop"], errors="coerce")
    genes_df = genes_df.dropna(subset=["chrom", "start", "stop"])

    # Sort human-style (1, 2, ... 22, X, Y)
    # We can create a temporary sorting key for chromosomes
    def chrom_key(c):
        if c == "X":
            return 23
        if c == "Y":
            return 24
        try:
            return int(c)
        except:
            return 99

    genes_df["chrom_sort"] = genes_df["chrom"].apply(chrom_key)
    genes_df = genes_df.sort_values(by=["chrom_sort", "start"]).drop(
        columns=["chrom_sort"]
    )

    # Assign batch IDs so each batch is strictly contained to one chromosome
    batch_counter = 0
    batch_ids = []

    for chrom, group in genes_df.groupby("chrom", sort=False):
        for i in range(0, len(group), batch_size):
            # Fill the next N rows with the current batch ID
            chunk_len = len(group.iloc[i : i + batch_size])
            batch_ids.extend([batch_counter] * chunk_len)
            batch_counter += 1

    genes_df["batch_id"] = batch_ids
    return genes_df


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

        except Exception as e:
            print(f"Process cleanup error (safe to ignore): {e}")

        time.sleep(3)

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
# python data-pipelines/generate_recessive_dashboard_lists.py --genes-file=20240730_spot_check_genes.csv
# uv run python data-pipelines/generate_recessive_dashboard_lists.py \
#     --genes-file=2026-05-29_genie-input_5k-disease-associated-genes.csv \
#     --test
def main() -> None:
    start_time = datetime.now()

    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", required=False)
    parser.add_argument("--directory-root", required=False)
    parser.add_argument("--genes-file", required=False)
    parser.add_argument("--test", action="store_true", required=False)
    args = parser.parse_args()

    base_dir = os.path.join(os.path.dirname(__file__), "../data")
    if args.directory_root:
        base_dir = args.directory_root

    input_genes_filename = GENIE_RECESSIVE_DASHBOARD_INPUT_GENES_PATH
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

    print("Initializing Hail for global data prep...")
    hl.init(
        quiet=args.quiet,
        master="local[8]",
        spark_conf={
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
        },
    )

    gene_models_ht_fullpath = os.path.join(
        base_dir, "processed_data", "reindexed_gene_models.ht"
    )
    if not os.path.exists(gene_models_ht_fullpath):
        prepare_gene_models(GNOMAD_GRCH38_GENES_PATH, base_dir)

    # TK: TODO: break into helper -- sort and batch genes
    # ---

    print("Sorting and batching genes...")
    df_genes_batched = prepare_and_batch_genes(
        input_genes_csv_fullpath,
        gene_models_ht_fullpath,
        batch_size=BATCH_SIZE,
    )

    # --- DEBUG LOGGING ---
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

    gene_models_path = os.path.join(
        base_dir, "processed_data", "reindexed_gene_models.ht"
    )
    if not os.path.exists(gene_models_path):
        print(f"Path {gene_models_path} does not exist, creating ht.")
        prepare_gene_models(GNOMAD_GRCH38_GENES_PATH, base_dir)

    for batch_id in range(num_batches):
        try:
            print("starting cleanup")
            safe_cleanup()

            print("initializing hail")
            hl.init(
                quiet=args.quiet,
                master="local[8]",
                spark_conf={
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
                },
            )

            batch_start_time = datetime.now()

            df_genes_this_batch = df_genes_batched[
                df_genes_batched["batch_id"] == batch_id
            ].copy()
            batch_length = len(df_genes_this_batch)

            print(f"\nBeginning batch_id: {batch_id}, size: {batch_length}")

            # ---
            print("\n\n===DEBUG!")
            for row in df_genes_this_batch.itertuples():
                print(
                    f"(batch_id): {row.batch_id} | Symbol: {row.symbol} | Type: {row.type} | Chrom: {row.chrom} | Range: {row.start}-{row.stop} | Type: {row.type} | Should Calc: {row.should_calculate_recessive}"
                )
            print("\n\n")
            # ---

            print("Preparing dashboard list models ...")
            df_dashboard_models = prepare_dashboard_lists(
                input_genes_fullpath, base_dir, start=batch_start, stop=batch_stop
            )
            model_output_file = (
                Path(base_dir)
                / "output"
                / "recessive_dashboard"
                / "models"
                / f"{file_prefix}recessive_dashboard_models_{batch_start}-{batch_stop_print}.csv"
            )
            model_output_file.parent.mkdir(parents=True, exist_ok=True)
            df_dashboard_models.to_csv(model_output_file, index=False)
            print("Wrote dashboard list models to file")

            # ---

            print("Preparing dashboard list downloads")
            df_dashboard_download = prepare_dashboard_download(
                base_dir, df_dashboard_models
            )
            download_output_file = (
                Path(base_dir)
                / "output"
                / "recessive_dashboard"
                / "models"
                / f"{file_prefix}recessive_dashboard_downloads_{batch_start}-{batch_stop_print}.csv"
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
