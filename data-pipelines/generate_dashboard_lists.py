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
def prepare_gene_models(gnomAD_gene_models_path):
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

    ht.write("../data/reindexed_gene_models.ht", overwrite=True)

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
    print("  REMOVE ME: running process_dashboard_list")
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

    include_from_clinvar = (
        clinvar_variants[ht.locus, ht.alleles].clinical_significance_category
        == "pathogenic_or_likely_pathogenic"
    )

    ht = ht.annotate(include_from_clinvar=include_from_clinvar)

    ht = ht.filter(ht.include_from_gnomad | ht.include_from_clinvar)

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

    # calculate total summary frequency and prevalence
    carrier_frequency_array = []
    carrier_frequency_simplified_array = []
    prevalence_array = []
    for q in total_allele_frequencies:
        carrier_frequency = 2 * (1 - q) * q
        carrier_frequency_array.append(carrier_frequency)

        carrier_frequency_simplified = 2 * q
        carrier_frequency_simplified_array.append(carrier_frequency_simplified)

        prevalence = q ** 2
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

    calculations_object = {
        "carrier_frequency": carrier_frequency_array,
        "prevalence": prevalence_array,
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


def prepare_dashboard_lists(genes_fullpath):
    ds = hl.import_table(
        genes_fullpath, delimiter=",", quote='"', key="symbol", impute=True
    )

    # Using checkpoint instead of function to speed up development, if first time running
    #   this helper should be called to generate the checkoint
    # ht_gnomad_gene_models = prepare_gene_models(GNOMAD_GRCH38_GENES_PATH)
    # print(ht_gnomad_gene_models.describe())

    GNOMAD_CHECKPOINTED_GRCH38_GENES_PATH = "/Users/rgrant/dev/work-broad/genetic-prevalence-estimator/data/reindexed_gene_models.ht"
    ht_gnomad_gene_models = hl.read_table(GNOMAD_CHECKPOINTED_GRCH38_GENES_PATH)

    # annotate my list of gene symbols with gene model information
    ds = ds.annotate(**ht_gnomad_gene_models[ds.symbol])

    # load gnomad and clinvar tables for use in main task
    LOCAL_GNOMAD_V4_VARIANTS_PATH = "/Users/rgrant/dev/work-broad/genetic-prevalence-estimator/data/gnomAD_v4.1.0_variants.ht"
    ht_gnomad_variants = hl.read_table(LOCAL_GNOMAD_V4_VARIANTS_PATH)
    metadata_populations = hl.eval(ht_gnomad_variants.globals.populations)

    LOCAL_CLINVAR_GRCH38_PATH = "/Users/rgrant/dev/work-broad/genetic-prevalence-estimator/data/ClinVar_GRCh38_variants.ht"
    ht_clinvar_variants = hl.read_table(LOCAL_CLINVAR_GRCH38_PATH)
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

    # TODO: need to get orphanet data, create task to call and create its own CSV
    LOCAL_ORPHANET_PATH = "/Users/rgrant/dev/work-broad/genetic-prevalence-estimator/data/orphanet_prevalences.tsv"
    ds_orphanet_prevalences = pd.read_csv(LOCAL_ORPHANET_PATH, sep="\t")

    ds = annotate_variants_with_orphanet_prevalences(ds, ds_orphanet_prevalences)
    df["genetic_prevalence_genereviews"] = ""
    df["genetic_prevalence_other"] = ""
    df["genetic_incidence_other"] = ""

    for index, row in df.iterrows():
        print(f"=== Processing row {index + 1} of {len(df)}")
        print(f"  gene_id is: {row.gene_id}")

        gene_id_with_version = f"{row.gene_id}.{row.gene_version}"
        transcript_id_with_version = f"{row.preferred_transcript_id}.{row.mane_select_transcript_ensemble_version}"

        df.at[index, "label"] = f"{row.symbol} - Dashboard"
        df.at[
            index, "notes"
        ] = f"This list was algorithmically generated for the gene {row.symbol}, with the transcript {row.preferred_transcript_id}"

        current_datetime = datetime.now()
        iso_8601_datetime = current_datetime.isoformat()
        df.at[index, "date_created"] = iso_8601_datetime

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

    LOCAL_ORPHANET_PATH = "/Users/rgrant/dev/work-broad/genetic-prevalence-estimator/data/orphanet_prevalences.tsv"
    ds_orphanet_prevalences = pd.read_csv(LOCAL_ORPHANET_PATH, sep="\t")
    df = annotate_variants_with_orphanet_prevalences(df, ds_orphanet_prevalences)

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
        "genetic_prevalence_other",  # TODO: should this be here? or on a variant list
        "genetic_incidence_other",  # TODO: should this be here? or on a variant list
    ]
    df = df[FINAL_COLUMNS]

    return df


def prepare_dashboard_download(dataframe):

    df_download = dataframe

    for index, row in df_download.iterrows():
        metadata = json.loads(row["metadata"])

        top_ten_variants = json.loads(row["top_ten_variants"])

        calculations = json.loads(row["variant_calculations"])
        carrier_frequency = calculations["carrier_frequency"]
        prevalence = calculations["prevalence"]

        # metadata ones
        df_download.at[index, "gene_symbol"] = metadata["gene_symbol"]
        df_download.at[index, "transcript_id"] = metadata["transcript_id"]
        df_download.at[index, "gnomad_version"] = metadata["gnomad_version"]
        df_download.at[index, "reference_genome"] = metadata["reference_genome"]
        df_download.at[index, "gene_symbol"] = metadata["gene_symbol"]
        df_download.at[index, "included_clinvar_variants"] = ", ".join(
            metadata["include_clinvar_clinical_significance"]
        )
        df_download.at[index, "clinvar_version"] = metadata["clinvar_version"]

        df_download.at[index, "date_created"] = row["date_created"]

        # all the carrier and prevalence things
        df_download.at[index, "carrier_frequency_global"] = carrier_frequency[0]
        df_download.at[
            index, "carrier_frequency_african_african_american"
        ] = carrier_frequency[1]
        df_download.at[index, "carrier_frequency_admixed_american"] = carrier_frequency[
            2
        ]
        df_download.at[index, "carrier_frequency_ashkenazi_jewish"] = carrier_frequency[
            3
        ]
        df_download.at[index, "carrier_frequency_east_asian"] = carrier_frequency[4]
        df_download.at[index, "carrier_frequency_european_finnish"] = carrier_frequency[
            5
        ]
        df_download.at[index, "carrier_frequency_middle_eastern"] = carrier_frequency[6]
        df_download.at[
            index, "carrier_frequency_european_non_finnish"
        ] = carrier_frequency[7]
        df_download.at[index, "carrier_frequency_remaining"] = carrier_frequency[8]
        df_download.at[index, "carrier_frequency_south_asian"] = carrier_frequency[9]

        df_download.at[index, "genetic_prevalence_global"] = prevalence[0]
        df_download.at[
            index, "genetic_prevalence_african_african_american"
        ] = prevalence[1]
        df_download.at[index, "genetic_prevalence_admixed_american"] = prevalence[2]
        df_download.at[index, "genetic_prevalence_ashkenazi_jewish"] = prevalence[3]
        df_download.at[index, "genetic_prevalence_east_asian"] = prevalence[4]
        df_download.at[index, "genetic_prevalence_european_finnish"] = prevalence[5]
        df_download.at[index, "genetic_prevalence_middle_eastern"] = prevalence[6]
        df_download.at[index, "genetic_prevalence_european_non_finnish"] = prevalence[7]
        df_download.at[index, "genetic_prevalence_remaining"] = prevalence[8]
        df_download.at[index, "genetic_prevalence_south_asian"] = prevalence[9]

        for variant_index, variant in enumerate(top_ten_variants):

            prefix = f"variant_{variant_index + 1}"
            allele_count = variant["AC"][0]
            allele_number = variant["AN"][0]

            df_download.at[index, f"{prefix}_gnomad_id"] = variant["id"]
            df_download.at[index, f"{prefix}_vep_consequence"] = variant[
                "major_consequence"
            ]
            df_download.at[index, f"{prefix}_hgvsc"] = variant["hgvsc"]
            df_download.at[index, f"{prefix}_hgvsp"] = variant["hgvsp"]
            df_download.at[index, f"{prefix}_loftee"] = variant["lof"]
            df_download.at[index, f"{prefix}_clinvar_clinical_significance"] = (
                None
                if variant["clinical_significance"] == None
                else variant["clinical_significance"][0]
            )
            df_download.at[index, f"{prefix}_clinvar_variation_id"] = variant[
                "clinvar_variation_id"
            ]
            df_download.at[index, f"{prefix}_allele_count"] = int(allele_count)
            df_download.at[index, f"{prefix}_allele_number"] = int(allele_number)
            df_download.at[index, f"{prefix}_allele_frequency"] = (
                0
                if allele_count == 0
                else "{:.2e}".format(allele_count / allele_number)
            )

            df_download.at[index, f"{prefix}_source"] = ", ".join(variant["source"])
            df_download.at[index, f"{prefix}_flags"] = ", ".join(variant["flags"])

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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--genes-file")
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    csv_dir = os.path.join(os.path.dirname(__file__), "../data")

    genes_filename = "TEST_ar_genes_genie.csv"
    if args.genes_file:
        genes_filename = args.genes_file

    genes_fullpath = os.path.join(csv_dir, genes_filename)

    df_dashboard_models = prepare_dashboard_lists(genes_fullpath)
    df_dashboard_models.to_csv("data/output.csv", index=False)

    df_dashboard_download = prepare_dashboard_download(df_dashboard_models)
    df_dashboard_download.to_csv("data/download.csv", index=False)


if __name__ == "__main__":
    main()
