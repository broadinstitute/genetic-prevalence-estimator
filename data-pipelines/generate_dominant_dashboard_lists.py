import pandas as pd
import argparse
import json
import hail as hl

import os

from datetime import datetime

from generate_recessive_dashboard_lists import prepare_gene_models


LOCAL_BASE_DIR = os.path.join(os.path.dirname(__file__), "../data")

LOCAL_DISEASE_ASSOCIATED_GENES_FILENAME = (
    "2026-05-29_genie-input_5k-disease-associated-genes.csv"
)
LOCAL_DOMINANT_INPUT_GENES_FILENAME = (
    "2026-05-29_genie-input_17k-dominant-v4p1p1-stats-genes.csv"
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
    has_insufficient_missense_data = False
    has_insufficient_lof_data = False

    if oe_mis is not None and mu_mis is not None:
        missense_de_novo_incidence = ((oe_mis_prior - oe_mis) * mu_mis) * 2
        missense_de_novo_incidence = (
            missense_de_novo_incidence if missense_de_novo_incidence > 0 else 0
        )
    else:
        missense_de_novo_incidence = 0
        has_insufficient_missense_data = True

    if oe_lof is not None and mu_lof is not None:
        lof_de_novo_incidence = ((oe_lof_prior - oe_lof) * mu_lof) * 2
        lof_de_novo_incidence = (
            lof_de_novo_incidence if lof_de_novo_incidence > 0 else 0
        )
    else:
        lof_de_novo_incidence = 0
        has_insufficient_lof_data = True

    total_de_novo_incidence = missense_de_novo_incidence + lof_de_novo_incidence

    na_sentinel_value = -1.337

    calculations_object = {
        "missense_de_novo_incidence": missense_de_novo_incidence,
        "lof_de_novo_incidence": lof_de_novo_incidence,
        "total_de_novo_incidence": total_de_novo_incidence,
        "has_insufficient_missense_data": has_insufficient_missense_data,
        "has_insufficient_lof_data": has_insufficient_lof_data,
        "inputs": {
            "oe_mis": oe_mis if oe_mis is not None else na_sentinel_value,
            "mu_mis": mu_mis if mu_mis is not None else na_sentinel_value,
            "oe_mis_prior": oe_mis_prior,
            "oe_lof": oe_lof if oe_lof is not None else na_sentinel_value,
            "mu_lof": mu_lof if mu_lof is not None else na_sentinel_value,
            "oe_lof_prior": oe_lof_prior,
        },
    }

    return calculations_object


def annotate_row_with_dominant_incidence_dictionary(dataframe, index):
    row = dataframe.loc[index]

    def get_safe_float(field_name):
        val = row.get(field_name)
        if pd.isna(val) or val == "NA" or val == "":
            return None
        return float(val)

    oe_mis = get_safe_float("oe_mis")
    mu_mis = get_safe_float("mu_mis")
    oe_lof = get_safe_float("oe_lof")
    mu_lof = get_safe_float("mu_lof")

    if all(v is None for v in [oe_mis, mu_mis, oe_lof, mu_lof]):
        print(
            f"Skipping calculations for gene: {row.get('symbol', 'UNKNOWN')} - All input constraint metrics (oe_mis, mu_mis, oe_lof, mu_lof) were missing."
        )

    dominant_stats_dictionary = calculate_missense_and_lof_de_novo_incidence(
        oe_mis=oe_mis,
        mu_mis=mu_mis,
        oe_lof=oe_lof,
        mu_lof=mu_lof,
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


def prepare_dominant_dashboard_download(
    input_genes_path,
    input_disease_associated_genes_with_inheritance_types_path,
    base_dir,
):
    ht_dominant_dashboard_list_input = hl.import_table(
        input_genes_path,
        delimiter=",",
        quote='"',
        key="symbol",
        impute=True,
    )

    ht_disease_associated_genes = hl.import_table(
        input_disease_associated_genes_with_inheritance_types_path,
        delimiter=",",
        quote='"',
        key="symbol",
        impute=True,
    )

    # ---

    ht_dominant_models = ht_dominant_dashboard_list_input.annotate(
        **ht_disease_associated_genes[ht_dominant_dashboard_list_input.symbol]
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
    df["gene_symbol"] = df["symbol"]

    for index, row in df.iterrows():
        if index % 500 == 0:
            print(f"Processing row {index + 1} of {len(df)}")

        required_metadata = [
            row.get("gene_id"),
            row.get("gene_version"),
            row.get("preferred_transcript_id"),
        ]

        if any(pd.isna(field) or field in ("", "<NA>") for field in required_metadata):
            print(f"Skipping {row.symbol} due to missing metadata")
            continue

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
            print(
                f"Skipping calculations for gene: {row.symbol} - Missing genomic coordinates."
            )
            continue

        annotate_row_with_dominant_incidence_dictionary(
            dataframe=df,
            index=index,
        )

    FINAL_COLUMNS = [
        "gene_id",
        "gene_symbol",
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


def prepare_dominant_dashboard_models(df_dashboard_download):
    """
    Trim the models file to just disease associated genes
    as the dashboard should ONLY have disease associated genes on it.
    Also, remove the 'gene_symbol' column
    """
    FINAL_COLUMNS = [
        "gene_id",
        "date_created",
        "metadata",
        "de_novo_variant_calculations",
        "type",
    ]
    df_dashboard_models = df_dashboard_download[FINAL_COLUMNS]

    df_dashboard_models = df_dashboard_models[df_dashboard_models["type"] != "NA"]

    return df_dashboard_models


# e.g.
# uv run python data-pipelines/generate_dominant_dashboard_lists.py
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", required=False)
    parser.add_argument("--bind-spark", action="store_true", required=False)
    parser.add_argument("--directory-root", required=False)
    parser.add_argument("--input-dominant-genes-filename", required=False)
    parser.add_argument("--input-disease-associated-genes-filename", required=False)
    args = parser.parse_args()

    init_kwargs = {"quiet": args.quiet}

    if args.bind_spark:
        init_kwargs["spark_conf"] = {
            "spark.driver.bindAddress": "127.0.0.1",
            "spark.driver.host": "127.0.0.1",
        }

    hl.init(**init_kwargs)

    base_dir = LOCAL_BASE_DIR
    if args.directory_root:
        base_dir = args.directory_root

    input_dominant_genes_filename = LOCAL_DOMINANT_INPUT_GENES_FILENAME
    if args.input_dominant_genes_filename:
        input_dominant_genes_filename = args.input_dominant_genes_filename
    input_genes_fullpath = os.path.join(
        base_dir, "input", input_dominant_genes_filename
    )

    print(f"Running with GIDNV genes stats input CSV of: {input_genes_fullpath}")

    input_disease_associated_genes_filename = LOCAL_DISEASE_ASSOCIATED_GENES_FILENAME
    if args.input_disease_associated_genes_filename:
        input_disease_associated_genes_filename = (
            args.input_disease_associated_genes_filename
        )
    input_disease_associated_genes_fullpath = os.path.join(
        base_dir, "input", input_disease_associated_genes_filename
    )

    print(
        f"Running with disease associated genes input CSV of: {input_disease_associated_genes_fullpath}"
    )

    print("Preparing dominant dashboard list models ...")
    df_dashboard_download = prepare_dominant_dashboard_download(
        input_genes_fullpath, input_disease_associated_genes_fullpath, base_dir
    )

    print(f"\n\ndownload info: \n")
    print(df_dashboard_download.info())

    df_dashboard_download.to_csv(
        os.path.join(
            base_dir, "output", "dominant_dashboard", "dominant-dashboard-download.csv"
        ),
        index=False,
    )
    print("Wrote dominant dashboard downloads file")

    df_dashboard_models = prepare_dominant_dashboard_models(df_dashboard_download)
    print(f"\n\nmodels info: \n")
    print(df_dashboard_models.info())
    df_dashboard_models.to_csv(
        os.path.join(
            base_dir, "output", "dominant_dashboard", "dominant-dashboard-models.csv"
        ),
        index=False,
    )
    print("Wrote dominant dashboard models file")


if __name__ == "__main__":
    main()
