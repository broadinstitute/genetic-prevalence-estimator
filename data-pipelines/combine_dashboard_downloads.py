import os
import pandas as pd
import re
from datetime import datetime
import argparse


def combine_csv_files(download_files_directory, output_filename):
    filenames = [f for f in os.listdir(download_files_directory) if f.endswith(".csv")]

    csv_files_with_numbers = []
    pattern = re.compile(r"_(\d+)-[^/\\]+\.csv$")
    for filename in filenames:
        match = pattern.search(filename)
        if match:
            try:
                start_number = int(match.group(1))
                csv_files_with_numbers.append((filename, start_number))
            except ValueError:
                continue
        else:
            print(f"File '{filename}' didn't match regex")

    if not csv_files_with_numbers:
        print(
            f"No CSV files found that matched the regex in {download_files_directory}"
        )
        return

    csv_files_with_numbers.sort(key=lambda x: x[1])
    sorted_csv_filenames = [filename for filename, _ in csv_files_with_numbers]

    print(
        f"Combining {len(sorted_csv_filenames)} CSV files from directory {download_files_directory}"
    )
    print(f"Combine order is:")
    for filename in sorted_csv_filenames:
        print(f" - {filename}")

    # ---

    df_full = []

    for filename in sorted_csv_filenames:
        filepath = os.path.join(download_files_directory, filename)
        try:
            df_curr = pd.read_csv(filepath)
            df_full.append(df_curr)
        except Exception as e:
            print(f"Error reading {filename}, error: {e}. Skipping.")

    combined_df = pd.concat(df_full, ignore_index=True)
    output_filepath = os.path.join(download_files_directory, output_filename)
    combined_df.to_csv(output_filepath, index=False)

    print(f"Successfully wrote combined CSV to {output_filepath}")


def main():
    start_time = datetime.now()

    parser = argparse.ArgumentParser()
    parser.add_argument("--output-filename", required=False)
    args = parser.parse_args()

    combined_filename = "dashboard-summary.csv"
    if args.output_filename:
        combined_filename = args.output_filename

    base_dir = os.path.join(os.path.dirname(__file__), "../data")
    downloads_directory = os.path.join(
        base_dir,
        "output",
        "dashboard",
        "downloads",
    )

    combine_csv_files(downloads_directory, combined_filename)

    end_time = datetime.now()
    print(f"Finished at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"It took: {end_time - start_time}")


if __name__ == "__main__":
    main()
