import argparse
import os
from pathlib import Path

from datetime import datetime

from recessive_dashboard.gene_batches import (
    prepare_and_batch_genes,
    prepare_gene_models,
    print_batch_summary,
)
from recessive_dashboard.gene_results import prepare_dashboard_gene_results
from recessive_dashboard.hail_session import init_hail, safe_cleanup
from recessive_dashboard.outputs import (
    prepare_dashboard_download,
    serialize_dashboard_models,
)

GENIE_RECESSIVE_DASHBOARD_INPUT_GENES_LOCAL_FILENAME = (
    "2026-06-12_genie-input_5k-disease-associated-dashboard-genes.csv"
)

GNOMAD_GRCH38_GENES_PATH = "gs://aggregate-frequency-calculator-data/input/genes/gnomAD_browser_genes_grch38_annotated_6.ht"

GNOMAD_V4_VARIANTS_PATH = (
    "gs://aggregate-frequency-calculator-data/gnomAD/gnomAD_v4.1.0_variants.ht"
)


# e.g.
# uv run python data-pipelines/generate_recessive_dashboard_lists.py \
#     --input-genes-file=2026-05-29_genie-input_5k-disease-associated-genes.csv \
#     --test
def main() -> None:
    start_time = datetime.now()

    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", required=False)
    parser.add_argument("--directory-root", required=False)
    parser.add_argument("--input-genes-file", required=False)
    parser.add_argument("--test", action="store_true", required=False)
    parser.add_argument("--gnomad-variants-path", default=GNOMAD_V4_VARIANTS_PATH)
    args = parser.parse_args()

    base_dir = os.path.join(os.path.dirname(__file__), "../data")
    if args.directory_root:
        base_dir = args.directory_root

    input_genes_filename = GENIE_RECESSIVE_DASHBOARD_INPUT_GENES_LOCAL_FILENAME
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

    print(f"\nRunning with input file: {input_genes_csv_fullpath}\n")

    print("Initializing Hail for global data prep...")
    init_hail(quiet=args.quiet)

    gene_models_ht_fullpath = os.path.join(
        base_dir, "processed_data", "reindexed_gene_models.ht"
    )
    if not os.path.exists(gene_models_ht_fullpath):
        prepare_gene_models(GNOMAD_GRCH38_GENES_PATH, base_dir)

    print("Sorting and batching genes...")
    df_genes_batched = prepare_and_batch_genes(
        input_genes_csv_fullpath,
        gene_models_ht_fullpath,
        batch_size=BATCH_SIZE,
    )

    print_batch_summary(df_genes_batched)

    num_batches = df_genes_batched["batch_id"].max() + 1
    print(f"Successfully sorted genes into {num_batches} distinct batches.")

    TEST_GENE_AMOUNT = 20
    if args.test:
        print("Got test arg, moving to single batch of 20 ...")
        df_genes_batched = df_genes_batched.iloc[0:TEST_GENE_AMOUNT]
        df_genes_batched["batch_id"] = 0
        file_prefix = "test_"
        num_batches = 1

    for batch_id in range(num_batches):
        try:
            print("starting cleanup")
            safe_cleanup()

            print("initializing hail")
            init_hail(quiet=args.quiet)

            batch_start_time = datetime.now()

            df_genes_this_batch = df_genes_batched[
                df_genes_batched["batch_id"] == batch_id
            ].copy()
            batch_length = len(df_genes_this_batch)

            print(f"\nBeginning batch_id: {batch_id}, size: {batch_length}")

            print("Preparing dashboard list models ...")

            gene_results = prepare_dashboard_gene_results(
                df_genes_this_batch, base_dir, args.gnomad_variants_path
            )
            df_dashboard_models = serialize_dashboard_models(gene_results)
            model_output_file = (
                Path(base_dir)
                / "output"
                / "recessive_dashboard"
                / "models"
                / f"{file_prefix}recessive_dashboard_models_batch-{batch_id + 1}-of-{num_batches}--{batch_length}-lists.csv"
            )
            model_output_file.parent.mkdir(parents=True, exist_ok=True)
            df_dashboard_models.to_csv(model_output_file, index=False)
            print("\n\nWrote dashboard list models to file")

            # ---

            print("Preparing dashboard list downloads")
            df_dashboard_download = prepare_dashboard_download(gene_results)
            download_output_file = (
                Path(base_dir)
                / "output"
                / "recessive_dashboard"
                / "downloads"
                / f"{file_prefix}recessive_dashboard_downloads_batch-{batch_id + 1}-of-{num_batches}--{batch_length}-lists.csv"
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
