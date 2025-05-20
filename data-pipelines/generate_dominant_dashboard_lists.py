import pandas as pd
import argparse
import json
import hail as hl

import os
import ast

from datetime import datetime

GNOMAD_GRCH38_GENES_PATH = "data/gnomAD/gnomAD_browser_genes_grch38_annotated_6.ht"

AD_PATH = "data/dominant-dashboard/clean_incidence_table.csv"

INHERITANCE_PATH = (
    "data/dominant-dashboard/AD_tables_for_genie.xlsx - Incidence table.csv"
)

OE_MISSENSE_PRIOR = 0.904
OE_LOF_PRIOR = 0.679


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
        os.path.join(base_dir, "dominant-dashboard/reindexed_gene_models.ht"),
        overwrite=True,
    )

    return ht


def calculate_carrier_frequency_and_prevalence(
    oe_mis_capped,
    mu_mis,
    oe_lof_capped,
    mu_lof,
    oe_mis_prior=0.904,
    oe_lof_prior=0.679,
):
    missense_de_novo_incidence = ((oe_mis_prior - oe_mis_capped) * mu_mis) * 2
    lof_de_novo_incidence = ((oe_lof_prior - oe_lof_capped) * mu_lof) * 2
    total_de_novo_incidence = missense_de_novo_incidence + lof_de_novo_incidence

    calculations_object = {
        "missense_de_novo_incidence": missense_de_novo_incidence,
        "lof_de_novo_incidence": lof_de_novo_incidence,
        "total_de_novo_incidence": total_de_novo_incidence,
        "inputs": {
            "oe_mis_capped": oe_mis_capped,
            "mu_mis": mu_mis,
            "oe_lof_capped": oe_lof_capped,
            "mu_lof": mu_lof,
            "oe_mis_prior": oe_mis_prior,
            "oe_lof_prior": oe_lof_prior,
        },
    }

    return calculations_object


def calculate_stats(dataframe, index):
    row = dataframe.loc[index]

    required_fields = ["oe_mis_Capped", "mu_mis", "oe_lof_capped", "mu_lof"]
    if any(pd.isna(row[field]) for field in required_fields):
        return

    stats_dict = calculate_carrier_frequency_and_prevalence(
        oe_mis_capped=float(row["oe_mis_Capped"]),
        mu_mis=float(row["mu_mis"]),
        oe_lof_capped=float(row["oe_lof_capped"]),
        mu_lof=float(row["mu_lof"]),
    )

    dataframe.at[index, "de_novo_variant_calculations"] = json.dumps(stats_dict)


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

    print(variants.columns, orphanet.columns)

    merged_df = pd.merge(variants, orphanet, on="gene_id", how="left")
    return merged_df


def prepare_dominant_dashboard_lists(input_path, base_dir):
    ds = hl.import_table(
        input_path,
        delimiter=",",
        quote='"',
        key="symbol",
        impute=True,
    )

    gene_models_path = os.path.join(base_dir, "dashboard/reindexed_gene_models.ht")
    if not os.path.exists(gene_models_path):
        print(f"Path {gene_models_path} does not exist, creating ht.")
        prepare_gene_models(GNOMAD_GRCH38_GENES_PATH, base_dir)

    ht_gnomad_gene_models = hl.read_table(gene_models_path)

    ds = ds.annotate(**ht_gnomad_gene_models[ds.symbol])

    df = ds.to_pandas()

    df[["oe_mis_Capped", "mu_mis", "oe_lof_capped", "mu_lof"]] = df[
        ["oe_mis_Capped", "mu_mis", "oe_lof_capped", "mu_lof"]
    ].apply(pd.to_numeric, errors="coerce")
    df["variants"] = [[] for _ in range(len(df))]
    df["top_ten_variants"] = [[] for _ in range(len(df))]
    df["label"] = ""
    df["notes"] = ""
    df["metadata"] = None
    current_datetime = datetime.now()
    iso_8601_datetime = current_datetime.isoformat()
    df["date_created"] = iso_8601_datetime
    df["de_novo_variant_calculations"] = [{} for _ in range(len(df))]

    ORPHANET_PATH = os.path.join(base_dir, "dashboard/orphanet_prevalences.tsv")
    df_orphanet_prevalences = pd.read_csv(ORPHANET_PATH, sep="\t")
    ds = annotate_variants_with_orphanet_prevalences(df, df_orphanet_prevalences)
    df["genetic_prevalence_genereviews"] = ""
    df["genetic_prevalence_other"] = ""
    df["genetic_incidence_other"] = ""

    df["inheritance_type"] = ""

    for index, row in df.iterrows():
        print(f"Processing row {index + 1} of {len(df)}")

        required_metadata = [
            row.get("gene_id"),
            row.get("gene_version"),
            row.get("preferred_transcript_id"),
            row.get("mane_select_transcript_ensemble_version"),
        ]

        # TODO: Come back to this
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
            "gnomad_version": "4.1.0",
            "reference_genome": "GRCh38",
            "gene_symbol": row.symbol,
            "gene_id": gene_id_with_version,
            "transcript_id": transcript_id_with_version,
        }

        df.at[index, "metadata"] = json.dumps(metadata)

        # TODO: Come back to this
        if pd.isna(row.start) or pd.isna(row.stop) or pd.isna(row.chrom):
            continue

        calculate_stats(
            dataframe=df,
            index=index,
        )

    df = annotate_variants_with_orphanet_prevalences(df, df_orphanet_prevalences)

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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", required=False)
    parser.add_argument("--directory-root", required=False)
    parser.add_argument("--genes-file", required=False)
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    base_dir = os.path.join(os.path.dirname(__file__), "../data")
    if args.directory_root:
        base_dir = args.directory_root

    genes_filename = "genes_with_type.csv"
    if args.genes_file:
        genes_filename = args.genes_file

    genes_fullpath = os.path.join(base_dir, "dominant-dashboard", genes_filename)

    print("Preparing dominant dashboard list models ...")
    df_dashboard_models = prepare_dominant_dashboard_lists(genes_fullpath, base_dir)
    df_dashboard_models.to_csv(
        os.path.join(base_dir, "dominant-dashboard/dominant-dashboard_models.csv"),
        index=False,
    )
    print("Wrote dominant dashboard list models to file")


if __name__ == "__main__":
    main()
