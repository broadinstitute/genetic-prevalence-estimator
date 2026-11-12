import os

import hail as hl
import pandas as pd


# Currently this is used on the first local run to create a checkpointed file,
#   if run in google cloud run, this would be run every time and checkpointing wouldn't
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


def _chromosome_sort_key(chrom):
    if chrom == "X":
        return 23
    if chrom == "Y":
        return 24
    if chrom in ("M", "MT"):
        return 25
    try:
        return int(chrom)
    except ValueError:
        return 99


def sort_and_batch_genes(df_genes, batch_size):
    df = df_genes
    print(f"  - {len(df)} -- Start")

    df = df.dropna(subset=["gene_id", "chrom", "start", "stop"])
    print(f"  - {len(df)} -- Post initial null drop on gene_id, chrom, start, stop")

    df["chrom"] = df["chrom"].astype(str).str.replace("^chr", "", regex=True)
    df["start"] = pd.to_numeric(df["start"], errors="coerce")
    df["stop"] = pd.to_numeric(df["stop"], errors="coerce")
    df = df.dropna(subset=["chrom", "start", "stop"])
    print(f"  - {len(df)} -- Post coersion of chrom, start, stop then dropna")

    df["chrom_sort"] = df["chrom"].apply(_chromosome_sort_key)

    df = (
        df.sort_values(by=["chrom_sort", "start"])
        .drop(columns=["chrom_sort"])
        .reset_index(drop=True)
    )

    batch_counter = 0
    batch_ids = []

    for _chrom, group in df.groupby("chrom", sort=False):
        for i in range(0, len(group), batch_size):
            chunk_len = len(group.iloc[i : i + batch_size])
            batch_ids.extend([batch_counter] * chunk_len)
            batch_counter += 1

    df["batch_id"] = batch_ids

    return df


def prepare_and_batch_genes(
    input_genes_csv_fullpath,
    gene_models_ht_path,
    batch_size,
):
    ds = hl.import_table(
        input_genes_csv_fullpath,
        delimiter=",",
        quote='"',
        key="symbol",
        impute=True,
    )

    # TK: possibly match on prior/alias symbols from gencode here
    #   currently, about 15 genes get dropped in this step
    ht_gnomad_gene_models = hl.read_table(gene_models_ht_path)
    ds = ds.annotate(**ht_gnomad_gene_models[ds.symbol])

    return sort_and_batch_genes(ds.to_pandas(), batch_size)


def print_batch_summary(df_genes_batched):
    print("\n--- Batch Summary ---")
    batch_summary = df_genes_batched.groupby("batch_id").agg(
        chrom=("chrom", "first"),
        num_genes=("symbol", "count"),
    )

    for batch_id, row in batch_summary.iterrows():
        print(
            f"Batch {batch_id:03d} | chr{row['chrom']:<2} | Genes: {row['num_genes']}"
        )
    print(f"Total Batches: {len(batch_summary)}")
    print("---------------------\n")
