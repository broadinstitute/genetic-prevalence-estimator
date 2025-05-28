import argparse
import json
import os
import ast

from datetime import datetime
import hail as hl
import pandas as pd

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


def open_file(path, mode="r"):
    if path.startswith("gs://"):
        return hl.hadoop_open(path, mode)
    else:
        return open(path, mode)


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


def annotate_variants_with_flags(ds, max_af_of_clinvar_path_or_likely_path_variants):
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
        ]
    ).filter(hl.is_defined)


# Currently this is used on the first local run to create a checkointed file,
#   if run in google cloud run, this would be run every time and checkointing wouldn't
#   be needed
def prepare_gene_models(gnomAD_gene_models_path, base_dir, subdir_name):
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
        os.path.join(base_dir, f"{subdir_name}/reindexed_gene_models.ht"),
        overwrite=True,
    )

    return ht


def get_highest_frequency_variants(ds, num_to_keep):
    ds = ds.filter(ds.AN[0] == 0, keep=False)
    ds = ds.order_by(hl.desc(ds.AC[0] / ds.AN[0]))
    ds = ds.head(num_to_keep)

    return ds


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

    # these should be kept in sync with the classifications in import_clinvar.py
    PATHOGENIC_CLASSIFICATIONS = [
        "association",
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

    ht = ht.filter(ht.include_from_gnomad | ht.include_from_clinvar)

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
        flags=annotate_variants_with_flags(
            ht, max_af_of_clinvar_path_or_likely_path_variants
        )
    )

    # TODO: move this logic further up?
    ht = ht.filter(~ht.flags.contains("filtered"))

    # TODO: lof curation for v2, later for v4

    table_fields = set(ht.row)
    select_fields = [field for field in VARIANT_FIELDS if field in table_fields]
    ht = ht.select(*select_fields)

    variants = [json.loads(variant) for variant in hl.json(ht.row_value).collect()]

    top_10_variants = get_highest_frequency_variants(ht, 10)
    top_10_variants = json.dumps(
        [
            json.loads(variant)
            for variant in hl.json(top_10_variants.row_value).collect()
        ]
    )

    dataframe.at[index, "top_ten_variants"] = top_10_variants

    return variants


def calculate_carrier_frequency_and_prevalence(variants, populations):
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
            "average_an": ac_an["AN"] / length,
        }
        carrier_frequency_raw_numbers_array.append(carrier_frequency_raw_numbers)

    prevalence_bayesian_array = []
    for q in multiplied_allele_frequencies:
        prevalence_bayesian = (1 - q) ** 2
        prevalence_bayesian_array.append(prevalence_bayesian)

    calculations_object = {
        "prevalence": prevalence_array,
        "prevalence_bayesian": prevalence_bayesian_array,
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


def prepare_dashboard_lists(genes_fullpath, base_dir):
    ds = hl.import_table(
        genes_fullpath,
        delimiter=",",
        quote='"',
        key="symbol",
        impute=True,
    )

    gene_models_path = os.path.join(base_dir, "dashboard/reindexed_gene_models.ht")
    if not os.path.exists(gene_models_path):
        print(f"Path {gene_models_path} does not exist, creating ht.")
        prepare_gene_models(GNOMAD_GRCH38_GENES_PATH, base_dir, "dashboard")

    ht_gnomad_gene_models = hl.read_table(gene_models_path)

    # annotate my list of gene symbols with gene model information
    ds = ds.annotate(**ht_gnomad_gene_models[ds.symbol])

    # load gnomad and clinvar tables for use in main task
    GNOMAD_V4_VARIANTS_PATH = os.path.join(base_dir, "gnomAD/gnomAD_v4.1.0_variants.ht")
    ht_gnomad_variants = hl.read_table(GNOMAD_V4_VARIANTS_PATH)
    metadata_populations = hl.eval(ht_gnomad_variants.globals.populations)

    CLINVAR_GRCH38_PATH = os.path.join(base_dir, "ClinVar/ClinVar_GRCh38_variants.ht")
    ht_clinvar_variants = hl.read_table(CLINVAR_GRCH38_PATH)
    metadata_clinvar_version = hl.eval(ht_clinvar_variants.globals.release_date)

    # iterate and perform the worker-esque task with pandas because hail does not like
    #   accessing values of rows while assigning them in a non hail expression way
    df = ds.to_pandas()
    df["variants"] = [[] for _ in range(len(df))]
    df["top_ten_variants"] = [[] for _ in range(len(df))]
    df["label"] = ""
    df["notes"] = ""
    df["metadata"] = None
    current_datetime = datetime.now()
    iso_8601_datetime = current_datetime.isoformat()
    df["date_created"] = iso_8601_datetime
    df["variant_calculations"] = [{} for _ in range(len(df))]

    ORPHANET_PATH = os.path.join(base_dir, "dashboard/orphanet_prevalences.tsv")
    df_orphanet_prevalences = pd.read_csv(ORPHANET_PATH, sep="\t")
    ds = annotate_variants_with_orphanet_prevalences(df, df_orphanet_prevalences)
    df["genetic_prevalence_genereviews"] = ""
    df["genetic_prevalence_other"] = ""
    df["genetic_incidence_other"] = ""

    df["inheritance_type"] = ""

    for index, row in df.iterrows():
        print(f"Processing row {index + 1} of {len(df)}")

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

        recommended_variants = process_dashboard_list(
            dataframe=df,
            index=index,
            transcript_id=transcript_id_with_version,
            start=row.start,
            stop=row.stop,
            chrom=row.chrom,
            gnomad_variants=ht_gnomad_variants,
            clinvar_variants=ht_clinvar_variants,
        )

        calculate_stats(
            dataframe=df,
            index=index,
            populations=metadata_populations,
            variants=recommended_variants,
        )

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

    return df


def prepare_dashboard_download(dataframe):
    download_data = []

    for _, row in dataframe.iterrows():
        metadata = json.loads(row["metadata"])
        top_ten_variants = json.loads(row["top_ten_variants"])
        calculations = json.loads(row["variant_calculations"])
        carrier_frequency = calculations["carrier_frequency"]
        prevalence = calculations["prevalence"]

        # prepare a temporary dictionary for all the data in this row to avoid repeated small insertions fragmenting the dataframe
        row_data = {
            "gene_symbol": metadata["gene_symbol"],
            "transcript_id": metadata["transcript_id"],
            "gnomad_version": metadata["gnomad_version"],
            "reference_genome": metadata["reference_genome"],
            "included_clinvar_variants": ", ".join(
                metadata["include_clinvar_clinical_significance"]
            ),
            "clinvar_version": metadata["clinvar_version"],
            "date_created": row["date_created"],
            "carrier_frequency_global": carrier_frequency[0],
            "carrier_frequency_african_african_american": carrier_frequency[1],
            "carrier_frequency_admixed_american": carrier_frequency[2],
            "carrier_frequency_ashkenazi_jewish": carrier_frequency[3],
            "carrier_frequency_east_asian": carrier_frequency[4],
            "carrier_frequency_european_finnish": carrier_frequency[5],
            "carrier_frequency_middle_eastern": carrier_frequency[6],
            "carrier_frequency_european_non_finnish": carrier_frequency[7],
            "carrier_frequency_remaining": carrier_frequency[8],
            "carrier_frequency_south_asian": carrier_frequency[9],
            "genetic_prevalence_global": prevalence[0],
            "genetic_prevalence_african_african_american": prevalence[1],
            "genetic_prevalence_admixed_american": prevalence[2],
            "genetic_prevalence_ashkenazi_jewish": prevalence[3],
            "genetic_prevalence_east_asian": prevalence[4],
            "genetic_prevalence_european_finnish": prevalence[5],
            "genetic_prevalence_middle_eastern": prevalence[6],
            "genetic_prevalence_european_non_finnish": prevalence[7],
            "genetic_prevalence_remaining": prevalence[8],
            "genetic_prevalence_south_asian": prevalence[9],
        }

        for variant_index, variant in enumerate(top_ten_variants):
            prefix = f"variant_{variant_index + 1}"
            allele_count = variant["AC"][0]
            allele_number = variant["AN"][0]

            row_data.update(
                {
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
            )

        download_data.append(row_data)

    df_download = pd.DataFrame(download_data)

    def generate_variant_columns(number):
        variant_columns = []

        prefix = f"variant_{number}"
        columns = [
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

        for column in columns:
            variant_columns.append(f"{prefix}_{column}")

        return variant_columns

    FINAL_COLUMNS = [
        "gene_symbol",
        "transcript_id",
        "gnomad_version",
        "reference_genome",
        "included_clinvar_variants",
        "clinvar_version",
        "date_created",
        # TODO: could use a helper if I wanted
        "carrier_frequency_global",
        "carrier_frequency_african_african_american",
        "carrier_frequency_admixed_american",
        "carrier_frequency_ashkenazi_jewish",
        "carrier_frequency_east_asian",
        "carrier_frequency_european_finnish",
        "carrier_frequency_middle_eastern",
        "carrier_frequency_european_non_finnish",
        "carrier_frequency_remaining",
        "carrier_frequency_south_asian",
        # could also here
        "genetic_prevalence_global",
        "genetic_prevalence_african_african_american",
        "genetic_prevalence_admixed_american",
        "genetic_prevalence_ashkenazi_jewish",
        "genetic_prevalence_east_asian",
        "genetic_prevalence_european_finnish",
        "genetic_prevalence_middle_eastern",
        "genetic_prevalence_european_non_finnish",
        "genetic_prevalence_remaining",
        "genetic_prevalence_south_asian",
    ]

    for number in range(1, 11):
        variant_columns = generate_variant_columns(number)
        FINAL_COLUMNS = FINAL_COLUMNS + variant_columns

    df_download = df_download[FINAL_COLUMNS]

    return df_download


# e.g.
# python data-pipelines/generate_dashboard_lists.py --genes-file=20240730_spot_check_genes.csv
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", required=False)
    parser.add_argument("--directory-root", required=False)
    parser.add_argument("--genes-file", required=False)
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    base_dir = os.path.join(os.path.dirname(__file__), "../data")
    if args.directory_root:
        base_dir = args.directory_root

    genes_filename = "all_genes.csv"
    if args.genes_file:
        genes_filename = args.genes_file

    genes_fullpath = os.path.join(base_dir, "dashboard", genes_filename)

    print("Preparing dashboard list models ...")
    df_dashboard_models = prepare_dashboard_lists(genes_fullpath, base_dir)
    df_dashboard_models.to_csv(
        os.path.join(base_dir, "dashboard/dashboard_models.csv"), index=False
    )
    print("Wrote dashboard list models to file")

    print("Preparing dashboard downloads")
    df_dashboard_download = prepare_dashboard_download(df_dashboard_models)
    df_dashboard_download.to_csv(
        os.path.join(base_dir, "dashboard/dashboard_download.csv"), index=False
    )
    print("Wrote dashboard downloads to file")


if __name__ == "__main__":
    main()
