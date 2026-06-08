import os
import pandas as pd
import re
from datetime import datetime
import argparse


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
    output_filepath = os.path.join(recessive_downloads_directory, output_filename)
    combined_df.to_csv(output_filepath, index=False)

    print(f"Successfully wrote combined CSV to {output_filepath}")


def create_5k_downloads(_input_recessive_file, _input_dominant_file, _output_filename):
    print("Running create 5k downloads helper")
    pass


def create_17k_downloads(_input_recessive_file, _input_dominant_file, _output_filename):
    print("Running create 17k downloads helper")
    pass


# e.g.:

# uv run python data-pipelines/combine_dashboard_downloads.py \
#     --action merge-recessive-downloads \
#     --output-filename combined-recessive-downloads.csv

# uv run python data-pipelines/combine_dashboard_downloads.py \
#     --action create-5k-download \
#     --input-recessive-file TK-FILE-HERE \
#     --input-dominant-file TK-FILE-HERE \
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
            "create-5k-download",
            "create-17k-download",
        ],
        required=True,
    )
    parser.add_argument("--output-filename", required=False)
    parser.add_argument("--input-recessive-file", required=False)
    parser.add_argument("--input-dominant-file", required=False)

    args = parser.parse_args()

    print(f"Running {args.action} ...")

    default_output_filename = None
    input_recessive_file = args.input_recessive_file
    input_dominant_file = args.input_dominant_file
    both_inputs_defined = input_recessive_file and input_dominant_file

    if args.action == "merge-recessive-downloads":
        default_output_filename = "download_single-file-recessive-combined.csv"

    elif args.action == "create-5k-download":
        default_output_filename = "download_5k-condition-associated-genes.csv"
        if not both_inputs_defined:
            print(
                f"Error! For creating 5k download, both recessive and dominant inputs must be defined"
            )
            exit(0)

    elif args.action == "create-17k-download":
        default_output_filename = "download_17k-all-genes.csv"
        if not both_inputs_defined:
            print(
                f"Error! For creating 5k download, both recessive and dominant inputs must be defined"
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

    elif args.action == "create-5k-downloads":
        create_5k_downloads(input_recessive_file, input_dominant_file, output_filename)

    elif args.action == "create-17k-downloads":
        create_17k_downloads(input_recessive_file, input_dominant_file, output_filename)

    else:
        print(f"Error! Unrecognized action: action: '{args.action}'")
        exit(0)

    end_time = datetime.now()
    print(f"Finished at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"It took: {end_time - start_time}")


if __name__ == "__main__":
    main()
