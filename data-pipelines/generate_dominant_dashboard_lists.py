import pandas as pd
import argparse
import json
import hail as hl

import os
import ast

from datetime import datetime

from generate_recessive_dashboard_lists import prepare_gene_models


LOCAL_BASE_DIR = os.path.join(os.path.dirname(__file__), "../data")

LOCAL_SYMBOLS_AND_INHERITANCE_TYPES_PATH = os.path.join(
    LOCAL_BASE_DIR,
    "input",
    "dominant_dashboard",
    "2025-05_gene-symbols-and-inheritance-types.csv",
)
LOCAL_DOMINANT_INPUT_GENES_FILENAME = (
    "2026-05-11_gnomad-v4p1p1_dominant-incidence-gene-list-input.csv"
)
LOCAL_ORPHANET_PATH = os.path.join(
    LOCAL_BASE_DIR, "processed_data", "orphanet_prevalences.tsv"
)
LOCAL_GNOMAD_GRCH38_GENE_MODELS_PATH = os.path.join(
    LOCAL_BASE_DIR, "gnomAD", "gene_models.ht"
)
LOCAL_REINDEXED_GRCH38_GENE_MODELS_PATH = os.path.join(
    LOCAL_BASE_DIR, "processed_data", "reindexed_gene_models.ht"
)

# TK:
GCS_BASE_DIR = "gs://aggregate-frequency-calculator-data"

GCS_SYMBOLS_AND_INHERITANCE_TYPES_PATH = "gs://aggregate-frequency-calculator-data/input/2025-05_recessive-dashboard-genelist-symbols-and-inheritance-types.csv"
GCS_DOMINANT_INPUT_GENES_FILENAME = "gs://aggregate-frequency-calculator-data/input/2025-10_dominant-incidence-gene-list-input.csv"
GCS_ORPHANET_PATH = (
    "gs://aggregate-frequency-calculator-data/input/2025-06-16_orphanet-prevalences.tsv"
)
GCS_GNOMAD_GRCH38_GENE_MODELS_PATH = (
    "gs://aggregate-frequency-calculator-data/input/gnomAD/gnomad_grch38_gene_models.ht"
)
GCS_REINDEXED_GRCH38_GENE_MODELS_PATH = "gs://aggregate-frequency-calculator-data/input/gnomAD/reindexed_gnomad_grch38_gene_models.ht"


def calculate_missense_and_lof_de_novo_incidence(
    oe_mis,
    mu_mis,
    oe_lof,
    mu_lof,
    oe_mis_prior=0.906,
    oe_lof_prior=0.675,
):
    missense_de_novo_incidence = ((oe_mis_prior - oe_mis) * mu_mis) * 2
    lof_de_novo_incidence = ((oe_lof_prior - oe_lof) * mu_lof) * 2
    total_de_novo_incidence = missense_de_novo_incidence + lof_de_novo_incidence

    calculations_object = {
        "missense_de_novo_incidence": missense_de_novo_incidence,
        "lof_de_novo_incidence": lof_de_novo_incidence,
        "total_de_novo_incidence": total_de_novo_incidence,
        "inputs": {
            "oe_mis": oe_mis,
            "mu_mis": mu_mis,
            "oe_lof": oe_lof,
            "mu_lof": mu_lof,
            "oe_mis_prior": oe_mis_prior,
            "oe_lof_prior": oe_lof_prior,
        },
    }

    return calculations_object


def annotate_row_with_dominant_incidence_dictionary(dataframe, index):
    row = dataframe.loc[index]

    required_fields = ["oe_mis", "mu_mis", "oe_lof", "mu_lof"]
    if any(pd.isna(row[field]) for field in required_fields):
        return

    dominant_stats_dictionary = calculate_missense_and_lof_de_novo_incidence(
        oe_mis=float(row["oe_mis"]),
        mu_mis=float(row["mu_mis"]),
        oe_lof=float(row["oe_lof"]),
        mu_lof=float(row["mu_lof"]),
    )

    dataframe.at[index, "de_novo_variant_calculations"] = json.dumps(
        dominant_stats_dictionary
    )


def create_or_read_reindexed_gnomad_gene_models_ht():
    reindexed_gene_models_table_exists = os.path.exists(
        LOCAL_REINDEXED_GRCH38_GENE_MODELS_PATH
    )

    if reindexed_gene_models_table_exists:
        ht_gnomad_gene_models = hl.read_table(LOCAL_REINDEXED_GRCH38_GENE_MODELS_PATH)
    else:
        print(f"Path {gene_models_path} does not exist, creating ht.")
        # TODO: possibly have prepare_gene_models download data locally? or have it throw a warning to say
        #  'run this helper script!'
        ht_gnomad_gene_models = prepare_gene_models(
            LOCAL_GNOMAD_GRCH38_GENE_MODELS_PATH, base_dir
        )

    return ht_gnomad_gene_models


def prepare_dominant_dashboard_lists(input_genes_path, base_dir):
    ht_inheritance_types = hl.import_table(
        LOCAL_SYMBOLS_AND_INHERITANCE_TYPES_PATH,
        delimiter=",",
        key="symbol",
        impute=True,
    )

    # ---

    ht_input_data = hl.import_table(
        input_genes_path,
        delimiter=",",
        quote='"',
        key="symbol",
        impute=True,
    )
    ht_dominant_models = ht_inheritance_types.annotate(
        **ht_input_data[ht_inheritance_types.symbol]
    )

    # ---

    ht_gnomad_gene_models = create_or_read_reindexed_gnomad_gene_models_ht()
    ht_dominant_models = ht_dominant_models.annotate(
        **ht_gnomad_gene_models[ht_dominant_models.symbol]
    )

    # ---

    df = ht_dominant_models.to_pandas()

    df[["oe_mis", "mu_mis", "oe_lof", "mu_lof"]] = df[
        ["oe_mis", "mu_mis", "oe_lof", "mu_lof"]
    ].apply(pd.to_numeric, errors="coerce")
    current_datetime = datetime.now()
    iso_8601_datetime = current_datetime.isoformat()
    df["date_created"] = iso_8601_datetime
    df["de_novo_variant_calculations"] = [{} for _ in range(len(df))]
    df["inheritance_type"] = ""

    # ---

    for index, row in df.iterrows():
        if index % 500 == 0:
            print(f"Processing row {index + 1} of {len(df)}")

        required_metadata = [
            row.get("gene_id"),
            row.get("gene_version"),
            row.get("preferred_transcript_id"),
            row.get("mane_select_transcript_ensemble_version"),
        ]

        if any(pd.isna(field) or field in ("", "<NA>") for field in required_metadata):
            print(f"Skipping {row.symbol} due to missing metadata")
            continue

        gene_id_with_version = f"{row.gene_id}.{row.gene_version}"
        transcript_id_with_version = f"{row.preferred_transcript_id}.{row.mane_select_transcript_ensemble_version}"

        current_datetime = datetime.now()
        iso_8601_datetime = current_datetime.isoformat()
        df.at[index, "date_created"] = iso_8601_datetime

        df.at[index, "inheritance_type"] = row.type

        metadata = {
            "gnomad_version": "4.1.1",
            "reference_genome": "GRCh38",
            "gene_symbol": row.symbol,
            "gene_id": gene_id_with_version,
            "transcript_id": transcript_id_with_version,
        }

        df.at[index, "metadata"] = json.dumps(metadata)

        if pd.isna(row.start) or pd.isna(row.stop) or pd.isna(row.chrom):
            continue

        annotate_row_with_dominant_incidence_dictionary(
            dataframe=df,
            index=index,
        )

    FINAL_COLUMNS = [
        "gene_id",
        "date_created",
        "metadata",
        "de_novo_variant_calculations",
        "type",
    ]
    df = df[FINAL_COLUMNS]

    df = df[
        df["gene_id"].notna()
        & df["metadata"].notna()
        & (df["metadata"] != "null")
        & (df["metadata"] != "{}")
    ]

    return df


# e.g.
# python data-pipelines/generate_dominant_dashboard_lists.py
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", required=False)
    parser.add_argument("--directory-root", required=False)
    parser.add_argument("--input-dominant-genes-filename", required=False)
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    base_dir = LOCAL_BASE_DIR
    if args.directory_root:
        base_dir = args.directory_root

    input_dominant_genes_filename = LOCAL_DOMINANT_INPUT_GENES_FILENAME
    if args.input_dominant_genes_filename:
        input_dominant_genes_filename = args.input_dominant_genes_filename

    input_genes_fullpath = os.path.join(
        base_dir, "input", "dominant_dashboard", input_dominant_genes_filename
    )

    print("Preparing dominant dashboard list models ...")
    df_dashboard_models = prepare_dominant_dashboard_lists(
        input_genes_fullpath, base_dir
    )
    df_dashboard_models.to_csv(
        os.path.join(
            base_dir, "output", "dominant_dashboard", "dominant-dashboard-models.csv"
        ),
        index=False,
    )
    print("Wrote dominant dashboard list models to file")


if __name__ == "__main__":
    main()
