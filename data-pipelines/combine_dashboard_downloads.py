import os
import pandas as pd
from datetime import datetime
import argparse
import json


def combine_csv_files(output_directory, output_filename):
    recessive_downloads_directory = os.path.join(
        output_directory,
        "recessive_dashboard",
        "downloads",
    )

    filenames = [
        f for f in os.listdir(recessive_downloads_directory) if f.endswith(".csv")
    ]
    non_test_files = [
        f for f in filenames if ((not "test" in f) and (not "combined" in f))
    ]
    non_test_files.sort(key=lambda x: int(x.split("-")[1]))
    sorted_non_test_files = [f for f in non_test_files]

    print(
        f"Combining {len(sorted_non_test_files)} CSV files from directory {recessive_downloads_directory}"
    )
    print(f"Combine order is:")
    for filename in sorted_non_test_files:
        print(f" - {filename}")

    # ---

    df_full = []

    for filename in sorted_non_test_files:
        filepath = os.path.join(recessive_downloads_directory, filename)
        try:
            df_curr = pd.read_csv(filepath)
            df_full.append(df_curr)
        except Exception as e:
            print(f"Error reading {filename}, error: {e}. Skipping.")

    combined_df = pd.concat(df_full, ignore_index=True)

    combined_df = combined_df.drop(
        columns=[
            "oe_missense_prior",
            "oe_missense_gene",
            "MU_mis",
            "oe_lof_prior",
            "oe_lof_gene",
            "MU_lof",
            "Estimated incidence of de novo variation",
            "Estimated incidence of de novo variation (per 100,000)",
        ]
    )

    output_filepath = os.path.join(recessive_downloads_directory, output_filename)
    combined_df.to_csv(output_filepath, index=False)

    print(f"Successfully wrote combined CSV to {output_filepath}")


def create_joined_downloads(
    output_directory, input_recessive_downloads_file, input_dominant_models_file
):
    print("Running create joined downloads helper")

    df_recessive = pd.read_csv(input_recessive_downloads_file)

    # ---

    df_dominant = pd.read_csv(input_dominant_models_file)

    # flatten dominant calcs
    df_dominant = df_dominant.join(
        df_dominant["de_novo_variant_calculations"].apply(json.loads).apply(pd.Series)
    )
    df_dominant = df_dominant.join(df_dominant["inputs"].apply(pd.Series))
    df_dominant["de_novo_estimated_per_100k"] = (
        pd.to_numeric(df_dominant["total_de_novo_incidence"], errors="coerce")
        .mul(100_000)
        .fillna("")
    )

    rename_dictionary = {
        "gene_symbol": "gene_symbol",
        "gene_id": "gene_id",
        "oe_mis_prior": "oe_missense_prior",
        "oe_mis": "oe_missense_gene",
        "mu_mis": "MU_mis",
        "oe_lof_prior": "oe_lof_prior",
        "oe_lof": "oe_lof_gene",
        "mu_lof": "MU_lof",
        "total_de_novo_incidence": "Estimated incidence of de novo variation",
        "de_novo_estimated_per_100k": "Estimated incidence of de novo variation (per 100,000)",
    }

    df_dominant = df_dominant.rename(columns=rename_dictionary)[
        [*rename_dictionary.values()]
    ]

    df_5k_merged = df_recessive.merge(df_dominant, on="gene_symbol", how="left")
    output_filepath = os.path.join(output_directory, "dashboard-summary.csv")
    df_5k_merged.to_csv(output_filepath, index=False)
    print("Wrote dashboard summary (~5k disease associated genes)")

    df_17k_merged = df_dominant.merge(df_recessive, on="gene_symbol", how="left")

    # re-order so that dominant columns are always at the end
    dominant_columns = [
        "oe_missense_prior",
        "oe_missense_gene",
        "MU_mis",
        "oe_lof_prior",
        "oe_lof_gene",
        "MU_lof",
        "Estimated incidence of de novo variation",
        "Estimated incidence of de novo variation (per 100,000)",
    ]
    recessive_columns = [c for c in df_17k_merged.columns if c not in dominant_columns]
    df_17k_merged = df_17k_merged[recessive_columns + dominant_columns]

    output_filepath = os.path.join(output_directory, "dashboard-all-genes-summary.csv")
    df_17k_merged.to_csv(output_filepath, index=False)
    print("Wrote dashboard summary (~17k all constraint genes no olfactory)")


# e.g.:

# uv run python data-pipelines/combine_dashboard_downloads.py \
#     --action merge-recessive-downloads \
#     --output-filename combined-recessive-downloads.csv

# uv run python data-pipelines/combine_dashboard_downloads.py \
#     --action create-joined-downloads \
#     --input-recessive-downloads-file /Users/rgrant/dev/work-broad/genetic-prevalence-estimator/data/output/recessive_dashboard/downloads/combined-recessive-downloads-no-mt.csv \
#     --input-dominant-models-file /Users/rgrant/dev/work-broad/genetic-prevalence-estimator/data/output/dominant_dashboard/dominant-dashboard-download.csv \
#     --output-filename disease-associated-genes-download-file.csv

# uv run python data-pipelines/combine_dashboard_downloads.py \
#     --action create-17k-download \
#     --input-recessive-file TK-FILE-HERE \
#     --input-dominant-file TK-FILE-HERE \
#     --output-filename all-genes-download-file.csv


def main():
    start_time = datetime.now()

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--action",
        choices=[
            "merge-recessive-downloads",
            "create-joined-downloads",
            # "create-5k-download",
            # "create-17k-download",
        ],
        required=True,
    )
    parser.add_argument("--output-filename", required=False)
    parser.add_argument("--input-recessive-downloads-file", required=False)
    parser.add_argument("--input-dominant-models-file", required=False)

    args = parser.parse_args()

    print(f"Running {args.action} ...")

    default_output_filename = None
    input_recessive_downloads_file = args.input_recessive_downloads_file
    input_dominant_models_file = args.input_dominant_models_file
    both_inputs_defined = input_recessive_downloads_file and input_dominant_models_file

    if args.action == "merge-recessive-downloads":
        default_output_filename = "download_single-file-recessive-combined.csv"

    elif args.action == "create-joined-downloads":
        default_output_filename = "download_5k-condition-associated-genes.csv"
        if not both_inputs_defined:
            print(
                f"Error! For creating joined downloads, both recessive and dominant inputs must be defined"
            )
            exit(0)

    if default_output_filename == None:
        print(f"Error! Unrecognized action: action: '{args.action}'")
        exit(0)

    output_filename = default_output_filename
    if args.output_filename:
        output_filename = args.output_filename

    base_dir = os.path.join(os.path.dirname(__file__), "../data")
    output_directory = os.path.join(
        base_dir,
        "output",
    )

    if args.action == "merge-recessive-downloads":
        combine_csv_files(output_directory, output_filename)

    elif args.action == "create-joined-downloads":
        create_joined_downloads(
            output_directory, input_recessive_downloads_file, input_dominant_models_file
        )

    else:
        print(f"Error! Unrecognized action: action: '{args.action}'")
        exit(0)

    end_time = datetime.now()
    print(f"Finished at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"It took: {end_time - start_time}")


if __name__ == "__main__":
    main()
