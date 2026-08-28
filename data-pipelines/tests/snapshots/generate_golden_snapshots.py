"""
Used to generate jsons for genes determined in this file that live in the repo as 'golden' json data snapshots. When refactoring the pipeline, these files can be compared to the output of the pipeline post change to guard against regressions


Usage:

    uv run python data-pipelines/tests/snapshots/generate_golden_snapshots.py \\
        [--source-data-root ./data]

"""

import argparse
import csv
import subprocess
import sys
import tempfile
from pathlib import Path

from snapshot_dashboard import generate_snapshots

REPO_ROOT = Path(__file__).resolve().parents[3]
PIPELINE_SCRIPT = REPO_ROOT / "data-pipelines" / "generate_recessive_dashboard_lists.py"
SNAPSHOTS_DIR = Path(__file__).resolve().parent / "golden"
GENES_CSV_FILENAME = "golden_fixture_genes.csv"
GENES_CSV_FIELDNAMES = [
    "symbol",
    "type",
    "Unique MOI Titles",
    "MOI with Classifications",
]

GOLDEN_FIXTURE_GENES = [
    {
        "symbol": "PCSK9",
        "type": "AD",
        "Unique MOI Titles": "Autosomal dominant",
        "MOI with Classifications": "Autosomal dominant (Definitive, Strong)",
        "reason": "well-behaved autosomal dominant gene, chr1: baseline path",
    },
    {
        "symbol": "ARG1",
        "type": "AR",
        "Unique MOI Titles": "Autosomal recessive",
        "MOI with Classifications": "Autosomal recessive (Definitive, Strong)",
        "reason": "autosomal recessive, different chromosome (chr6): exercises "
        "per-chromosome batching with more than one chromosome in the fixture",
    },
    # The five below all have curated public prevalence estimates on GenIE from known
    # staff users -- added together to widen chromosome coverage (chr15, chr4, chr17,
    # chr6, chr22) and give the suite real-world AR genes beyond ARG1.
    {
        "symbol": "EFL1",
        "type": "AR",
        "Unique MOI Titles": "Autosomal recessive",
        "MOI with Classifications": "Autosomal recessive (Moderate, Strong, Definitive)",
        "reason": "curated GenIE staff estimate; chr15",
    },
    {
        "symbol": "HADH",
        "type": "AR",
        "Unique MOI Titles": "Autosomal recessive",
        "MOI with Classifications": "Autosomal recessive (Definitive, Strong)",
        "reason": "curated GenIE staff estimate; chr4",
    },
    {
        "symbol": "SLC13A5",
        "type": "AR",
        "Unique MOI Titles": "Autosomal recessive",
        "MOI with Classifications": "Autosomal recessive (Strong, Definitive)",
        "reason": "curated GenIE staff estimate; chr17",
    },
    {
        "symbol": "EPM2A",
        "type": "AR",
        "Unique MOI Titles": "Autosomal recessive",
        "MOI with Classifications": "Autosomal recessive (Definitive, Strong)",
        "reason": "curated GenIE staff estimate; chr6 (second gene on this chromosome, "
        "alongside ARG1)",
    },
    {
        "symbol": "MLC1",
        "type": "AR",
        "Unique MOI Titles": "Autosomal recessive",
        "MOI with Classifications": "Autosomal recessive (Definitive, Strong)",
        "reason": "curated GenIE staff estimate; chr22",
    },
]


def write_genes_csv(path: Path, symbols: list[str] | None = None) -> None:
    """Write GOLDEN_FIXTURE_GENES as the pipeline's expected input CSV shape.

    Only GENES_CSV_FIELDNAMES columns are written - `reason` is fixture
    documentation for readers of this file, not part of the pipeline's input
    schema.

    `symbols`, if given, restricts the CSV to that subset of
    GOLDEN_FIXTURE_GENES (by `symbol`), instead of writing all of them.
    """
    genes = GOLDEN_FIXTURE_GENES
    if symbols is not None:
        known_symbols = {gene["symbol"] for gene in GOLDEN_FIXTURE_GENES}
        unknown_symbols = [symbol for symbol in symbols if symbol not in known_symbols]
        if unknown_symbols:
            raise ValueError(
                f"unknown golden fixture symbol(s): {', '.join(unknown_symbols)} -- "
                f"must be a subset of {sorted(known_symbols)}"
            )
        genes = [gene for gene in GOLDEN_FIXTURE_GENES if gene["symbol"] in symbols]

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=GENES_CSV_FIELDNAMES)
        writer.writeheader()
        for gene in genes:
            writer.writerow({column: gene[column] for column in GENES_CSV_FIELDNAMES})


def run_pipeline(
    source_data_root: Path, scratch_dir: Path, symbols: list[str] | None = None
) -> Path:
    """Run the real pipeline against a scratch directory-root with its own
    `input/` and `output/`, so this run's batch CSVs can't land in - or get
    confused with - the shared `data/output/recessive_dashboard/` that real
    runs write to. `processed_data/` (ClinVar, gene models, Orphanet) is
    deliberately not isolated: it's symlinked in from `source_data_root`
    read-only, since it's the same real data a production run would use and
    rebuilding it (particularly the gene models table) means a slow, network-
    bound Hail job. Returns the directory containing the run's models CSV(s).

    `symbols`, if given, restricts the run to that subset of
    GOLDEN_FIXTURE_GENES -- see `write_genes_csv`.
    """
    input_dir = scratch_dir / "input"
    input_dir.mkdir(parents=True)
    write_genes_csv(input_dir / GENES_CSV_FILENAME, symbols=symbols)

    shared_processed_data_dir = scratch_dir / "processed_data"
    shared_processed_data_dir.symlink_to(source_data_root / "processed_data")

    subprocess.run(
        [
            sys.executable,
            str(PIPELINE_SCRIPT),
            f"--input-genes-file={GENES_CSV_FILENAME}",
            f"--directory-root={scratch_dir}",
            "--quiet",
        ],
        check=True,
    )

    return scratch_dir / "output" / "recessive_dashboard" / "models"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-data-root", type=Path, default=REPO_ROOT / "data")
    args = parser.parse_args(argv)

    with tempfile.TemporaryDirectory(prefix="genie-golden-") as scratch:
        models_dir = run_pipeline(args.source_data_root, Path(scratch))
        written = generate_snapshots(
            models_dir, SNAPSHOTS_DIR, filename_field="metadata.gene_symbol"
        )

    print(f"wrote {len(written)} golden snapshot(s) to {SNAPSHOTS_DIR}")
    print(
        "review with `git diff data-pipelines/tests/snapshots/golden` before committing"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
