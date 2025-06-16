import argparse
import json
import os
import ast
import time
import signal

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
            # TODO: add "low_AN" flag?
            hl.or_missing(ds.homozygote_count[0] > 0, "has_homozygotes"),
        ]
    ).filter(hl.is_defined)


# Currently this is used on the first local run to create a checkointed file,
#   if run in google cloud run, this would be run every time and checkointing wouldn't
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


def prepare_dashboard_lists(genes_fullpath, base_dir, start, stop):
    ds = hl.import_table(
        genes_fullpath,
        delimiter=",",
        quote='"',
        key="symbol",
        impute=True,
    )

    gene_models_path = os.path.join(
        base_dir, "processed_data", "reindexed_gene_models.ht"
    )
    if not os.path.exists(gene_models_path):
        print(f"Path {gene_models_path} does not exist, creating ht.")
        prepare_gene_models(GNOMAD_GRCH38_GENES_PATH, base_dir)

    ht_gnomad_gene_models = hl.read_table(gene_models_path)

    # annotate my list of gene symbols with gene model information
    ds = ds.annotate(**ht_gnomad_gene_models[ds.symbol])

    # load gnomad and clinvar tables for use in main task
    # GNOMAD_V4_VARIANTS_PATH = os.path.join(base_dir, "gnomAD/gnomAD_v4.1.0_variants.ht")
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

    # iterate and perform the worker-esque task with pandas because hail does not like
    #   accessing values of rows while assigning them in a non hail expression way
    df = ds.to_pandas()

    if stop != None:
        df = df.iloc[start:stop]
    else:
        df = df.iloc[start:]

    print(f"Old len dataframe is: {len(df)}")

    manual_gene_ids = {
        "C12ORF57": {
            "gene_id": "ENSG00000111678",
            "gene_version": "11",
            "transcript_id": "ENST00000229281",
            "transcript_version": "6",
            "chrom": 12,
            "start": 6942978,
            "stop": 6946003,
        },
        "C12ORF65": {
            "gene_id": "ENSG00000130921",
            "gene_version": "9",
            "transcript_id": "ENST00000253233",
            "transcript_version": "6",
            "chrom": 12,
            "start": 123233385,
            "stop": 123258079,
        },
        "C15ORF41": {
            "gene_id": "ENSG00000186073",
            "gene_version": "14",
            "transcript_id": "ENST00000566621",
            "transcript_version": "6",
            "chrom": 15,
            "start": 36579626,
            "stop": 36810248,
        },
        "C19ORF12": {
            "gene_id": "ENSG00000131943",
            "gene_version": "20",
            "transcript_id": "ENST00000323670",
            "transcript_version": "14",
            "chrom": 19,
            "start": 29698937,
            "stop": 29715789,
        },
        "C8ORF37": {
            "gene_id": "ENSG00000156172",
            "gene_version": "6",
            "transcript_id": "ENST00000286688",
            "transcript_version": "6",
            "chrom": 8,
            "start": 95244913,
            "stop": 95269201,
        },
        "CCDC114": {
            "gene_id": "ENSG00000105479",
            "gene_version": "16",
            "transcript_id": "ENST00000674294",
            "transcript_version": "1",
            "chrom": 19,
            "start": 48296457,
            "stop": 48321971,
        },
        "CCDC151": {
            "gene_id": "ENSG00000198003",
            "gene_version": "12",
            "transcript_id": "ENST00000356392",
            "transcript_version": "9",
            "chrom": 19,
            "start": 11420604,
            "stop": 11435782,
        },
        "CLAM": {
            "gene_id": "ENSG00000101222",
            "gene_version": "12",
            "transcript_id": "ENST00000379756",
            "transcript_version": "3",
            "chrom": 20,
            "start": 3777504,
            "stop": 3781448,
        },
        "FAM126A": {
            "gene_id": "ENSG00000122591",
            "gene_version": "13",
            "transcript_id": "ENST00000432176",
            "transcript_version": "7",
            "chrom": 7,
            "start": 22889371,
            "stop": 23014130,
        },
        "MAP11": {
            "gene_id": "ENSG00000146826",
            "gene_version": "17",
            "transcript_id": "ENST00000316937",
            "transcript_version": "8",
            "chrom": 7,
            "start": 100154420,
            "stop": 100158723,
        },
        "SKIV2L": {
            "gene_id": "ENSG00000204351",
            "gene_version": "12",
            "transcript_id": "ENST00000375394",
            "transcript_version": "7",
            "chrom": 6,
            "start": 31959117,
            "stop": 31969751,
        },
        "SPATA5": {
            "gene_id": "ENSG00000145375",
            "gene_version": "9",
            "transcript_id": "ENST00000274008",
            "transcript_version": "5",
            "chrom": 4,
            "start": 122923070,
            "stop": 123319433,
        },
        "TCTEX1D2": {
            "gene_id": "ENSG00000213123",
            "gene_version": "11",
            "transcript_id": "ENST00000325318",
            "transcript_version": "10",
            "chrom": 3,
            "start": 196291219,
            "stop": 196318299,
        },
        "TTC25": {
            "gene_id": "ENSG00000204815",
            "gene_version": "10",
            "transcript_id": "ENST00000377540",
            "transcript_version": "6",
            "chrom": 17,
            "start": 41930617,
            "stop": 41966503,
        },
        "TTC37": {
            "gene_id": "ENSG00000198677",
            "gene_version": "12",
            "transcript_id": "ENST00000358746",
            "transcript_version": "7",
            "chrom": 5,
            "start": 95461755,
            "stop": 95554977,
        },
    }

    def stitch_values(row, manual_gene_ids):
        symbol = row["symbol"]
        if symbol in manual_gene_ids:
            manual_entry = manual_gene_ids[symbol]
            row["gene_id"] = manual_entry.get("gene_id", row["gene_id"])
            row["gene_version"] = manual_entry.get("gene_version", row["gene_version"])
            row["preferred_trancript_id"] = manual_entry.get(
                "transcript_id", row["preferred_transcript_id"]
            )
            row["mane_select_transcript_ensemble_version"] = manual_entry.get(
                "transcript_version", row["mane_select_transcript_ensemble_version"]
            )
            row["chrom"] = manual_entry.get("chrom", row["chrom"])
            row["start"] = manual_entry.get("start", row["stop"])
            row["stop"] = manual_entry.get("stop", row["stop"])
        return row

    df = df.apply(stitch_values, manual_gene_ids=manual_gene_ids, axis=1)

    missing_gene_id_rows = df[df["gene_id"].isna()]
    print("Gene symbols with missing gene_id:")
    print(missing_gene_id_rows["symbol"].tolist())

    # Drop rows with missing "gene_id"
    df = df.dropna(subset=["gene_id"])

    print(f"New len dataframe is: {len(df)}")

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
    for index, row in df.iterrows():
        batch_i += 1
        print(
            f"  -- Processing row {index + 1} [{row.symbol} - {row.gene_id}] ({batch_i} of {len(df)} in batch)"
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
        variant_count = calculations.get("variant_count")
        total_allele_frequency = calculations["total_allele_frequency"]
        carrier_frequency = calculations["carrier_frequency"]
        prevalence = calculations["prevalence"]

        # prepare a temporary dictionary for all the data in this row to avoid repeated small insertions fragmenting the dataframe
        row_data = {
            "gene_symbol": metadata["gene_symbol"],
            "transcript_id": metadata["transcript_id"],
            "gnomad_version": metadata["gnomad_version"],
            "reference_genome": metadata["reference_genome"],
            # "variant_count": variant_count,
            "# of P, LP and HC pLoF variants in gnomAD": variant_count,
            "included_clinvar_variants": ", ".join(
                metadata["include_clinvar_clinical_significance"]
            ),
            "clinvar_version": metadata["clinvar_version"],
            "date_created": row["date_created"],
            "allele_frequency_total": total_allele_frequency[0],
            "allele_frequency_african_african_american": total_allele_frequency[1],
            "allele_frequency_admixed_american": total_allele_frequency[2],
            "allele_frequency_ashkenazi_jewish": total_allele_frequency[3],
            "allele_frequency_east_asian": total_allele_frequency[4],
            "allele_frequency_european_finnish": total_allele_frequency[5],
            "allele_frequency_middle_eastern": total_allele_frequency[6],
            "allele_frequency_european_non_finnish": total_allele_frequency[7],
            "allele_frequency_remaining": total_allele_frequency[8],
            "allele_frequency_south_asian": total_allele_frequency[9],
            "carrier_frequency_total": carrier_frequency[0],
            "carrier_frequency_african_african_american": carrier_frequency[1],
            "carrier_frequency_admixed_american": carrier_frequency[2],
            "carrier_frequency_ashkenazi_jewish": carrier_frequency[3],
            "carrier_frequency_east_asian": carrier_frequency[4],
            "carrier_frequency_european_finnish": carrier_frequency[5],
            "carrier_frequency_middle_eastern": carrier_frequency[6],
            "carrier_frequency_european_non_finnish": carrier_frequency[7],
            "carrier_frequency_remaining": carrier_frequency[8],
            "carrier_frequency_south_asian": carrier_frequency[9],
            "genetic_prevalence_total": prevalence[0],
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
        # "variant_count",
        "# of P, LP and HC pLoF variants in gnomAD",
        "clinvar_version",
        "date_created",
        #
        "allele_frequency_total",
        "allele_frequency_african_african_american",
        "allele_frequency_admixed_american",
        "allele_frequency_ashkenazi_jewish",
        "allele_frequency_east_asian",
        "allele_frequency_european_finnish",
        "allele_frequency_middle_eastern",
        "allele_frequency_european_non_finnish",
        "allele_frequency_remaining",
        "allele_frequency_south_asian",
        # TODO: could use a helper if I wanted
        "carrier_frequency_total",
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
        "genetic_prevalence_total",
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


def safe_cleanup():
    try:
        try:
            hl.stop()
        except:
            pass
        time.sleep(1)

        try:
            cmds = [
                "jps | grep 'SparkSubmit' | awk '{print $1}'",
                "ps aux | grep '[S]parkSubmit' | awk '{print $2}'",
                "ps aux | grep '[h]ail' | awk '{print $2}'",
            ]
            for cmd in cmds:
                try:
                    pids = subprocess.check_output(cmd, shell=True).decode().strip()
                    if pids:
                        for pid in pids.split("\n"):
                            os.kill(int(pid), signal.SIGKILL)
                except:
                    pass

            os.system("rm -rf /tmp/hail*")
            os.system("rm -rf /tmp/spark*")

        except Exception as e:
            print(f"Process cleanup error (safe to ignore): {e}")

        time.sleep(3)

    except Exception as e:
        print(f"Cleanup error (safe to ignore): {e}")


# e.g.
# python data-pipelines/generate_dashboard_lists.py --genes-file=20240730_spot_check_genes.csv
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

    input_genes_filename = "all_genes.csv"
    if args.genes_file:
        input_genes_filename = args.genes_file

    input_genes_fullpath = os.path.join(base_dir, "input", input_genes_filename)

    start = 0
    batch_size = 100
    stop = 3999

    file_prefix = ""

    if args.test:
        start = 0
        batch_size = 5
        stop = 6
        file_prefix = "test_"

    for i in range(start, stop, batch_size):
        try:
            print("starting cleanup")
            safe_cleanup()

            print("initializing hail")
            hl.init(
                quiet=args.quiet,
                master="local[8]",
                spark_conf={
                    "spark.driver.memory": "8g",
                    "spark.executor.memory": "8g",
                    "spark.driver.maxResultSize": "4g",
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

            batch_start = i
            batch_stop = i + batch_size if i + batch_size < stop else None
            batch_stop_print = i + batch_size if i + batch_size < stop else "end"

            print(f"\nBeginning batch: {batch_start}-{batch_stop_print}")

            print("Preparing dashboard list models ...")
            df_dashboard_models = prepare_dashboard_lists(
                input_genes_fullpath, base_dir, start=batch_start, stop=batch_stop
            )
            df_dashboard_models.to_csv(
                os.path.join(
                    base_dir,
                    "output",
                    "dashboard",
                    "models",
                    f"{file_prefix}dashboard_models_{batch_start}-{batch_stop_print}.csv",
                ),
                index=False,
            )
            print("Wrote dashboard list models to file")

            print("Preparing dashboard downloads")
            df_dashboard_download = prepare_dashboard_download(df_dashboard_models)
            df_dashboard_download.to_csv(
                os.path.join(
                    base_dir,
                    "output",
                    "dashboard",
                    "downloads",
                    f"{file_prefix}dashboard_download_{batch_start}-{batch_stop_print}.csv",
                ),
                index=False,
            )
            print("Wrote dashboard downloads to file")

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
