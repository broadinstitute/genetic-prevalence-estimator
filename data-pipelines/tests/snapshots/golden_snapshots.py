"""Check the recessive dashboard pipeline against golden snapshots, or --update them."""

import argparse
import ast
import csv
import difflib
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

SNAPSHOTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SNAPSHOTS_DIR.parents[2]
PIPELINE_SCRIPT = REPO_ROOT / "data-pipelines" / "generate_recessive_dashboard_lists.py"
FIXTURE_GENES_CSV = SNAPSHOTS_DIR / "golden_fixture_genes.csv"
GOLDEN_DIR = SNAPSHOTS_DIR / "golden"
FAST_CHECK_SYMBOLS = ["SAMD11"]

PIPELINE_OUTPUT_DIRS = {
    "models": Path("recessive_dashboard/models"),
    "downloads": Path("recessive_dashboard/downloads"),
    "variants": Path("dashboard/individual_gene_files"),
}
GENE_SYMBOL_PATH_BY_OUTPUT = {
    "models": ["metadata", "gene_symbol"],
    "downloads": ["gene_symbol"],
}
VARIANT_FILE_PREFIX = "GeniE_dashboard_variants-"
CSV_FILES_SNAPSHOT_NAME = "_csv_files.json"
# The website's dashboard upload parses date_created with exactly this format.
DATE_CREATED_FORMAT = "%Y-%m-%dT%H:%M:%S.%f"


def read_fixture_genes() -> list[dict[str, str]]:
    with open(FIXTURE_GENES_CSV, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def run_pipeline(
    scratch_dir: Path,
    source_data_root: Path,
    symbols: list[str] | None,
    gnomad_variants_path: Path | None,
) -> Path:
    genes = [
        gene
        for gene in read_fixture_genes()
        if symbols is None or gene["symbol"] in symbols
    ]
    input_dir = scratch_dir / "input"
    input_dir.mkdir()
    with open(
        input_dir / FIXTURE_GENES_CSV.name, "w", newline="", encoding="utf-8"
    ) as f:
        writer = csv.DictWriter(f, fieldnames=genes[0].keys())
        writer.writeheader()
        writer.writerows(genes)

    # Symlinked, not copied: rebuilding processed_data is a slow Hail job.
    (scratch_dir / "processed_data").symlink_to(source_data_root / "processed_data")

    command = [
        sys.executable,
        str(PIPELINE_SCRIPT),
        f"--input-genes-file={FIXTURE_GENES_CSV.name}",
        f"--directory-root={scratch_dir}",
        "--quiet",
    ]
    if gnomad_variants_path is not None:
        command.append(f"--gnomad-variants-path={gnomad_variants_path.resolve()}")
    subprocess.run(command, check=True)
    return scratch_dir / "output"


def parse_structured_cell(value: str):
    for parse in (json.loads, ast.literal_eval):
        try:
            parsed = parse(value)
        except (ValueError, SyntaxError, TypeError):
            continue
        if isinstance(parsed, (dict, list)):
            return parsed
    return value


def write_json(path: Path, value) -> None:
    text = json.dumps(value, indent=2, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8")


def describe_date_created(value: str) -> str:
    try:
        datetime.strptime(value, DATE_CREATED_FORMAT)
    except (TypeError, ValueError):
        return value
    return f"<matches {DATE_CREATED_FORMAT}>"


def write_gene_row_snapshots(
    pipeline_csv_dir: Path, snapshot_dir: Path, gene_symbol_path: list[str]
) -> None:
    records_by_filename = {}
    for csv_path in sorted(pipeline_csv_dir.glob("*.csv")):
        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                record = {
                    column: (
                        describe_date_created(value)
                        if column == "date_created"
                        else parse_structured_cell(value)
                    )
                    for column, value in row.items()
                }
                symbol = record
                for key in gene_symbol_path:
                    symbol = symbol[key]
                filename = f"{symbol}-{record['gene_id']}.json"
                if records_by_filename.get(filename, record) != record:
                    raise ValueError(f"{filename}: pipeline CSVs disagree on this gene")
                records_by_filename[filename] = record

    snapshot_dir.mkdir(parents=True)
    for filename, record in records_by_filename.items():
        write_json(snapshot_dir / filename, record)


def write_variant_snapshots(pipeline_csv_dir: Path, snapshot_dir: Path) -> None:
    snapshot_dir.mkdir(parents=True)
    for csv_path in pipeline_csv_dir.glob(f"{VARIANT_FILE_PREFIX}*.csv"):
        with open(csv_path, newline="", encoding="utf-8") as f:
            variants = [
                {column: parse_structured_cell(value) for column, value in row.items()}
                for row in csv.DictReader(f)
            ]
        gene = csv_path.stem.removeprefix(VARIANT_FILE_PREFIX)
        write_json(snapshot_dir / f"{gene}.json", variants)


def write_csv_files_snapshot(pipeline_csv_dir: Path, snapshot_dir: Path) -> None:
    headers_by_filename = {}
    for csv_path in sorted(pipeline_csv_dir.glob("*.csv")):
        with open(csv_path, newline="", encoding="utf-8") as f:
            headers_by_filename[csv_path.name] = next(csv.reader(f), [])
    write_json(snapshot_dir / CSV_FILES_SNAPSHOT_NAME, headers_by_filename)


def write_snapshots(output_name: str, pipeline_output_dir: Path, snapshot_dir: Path):
    pipeline_csv_dir = pipeline_output_dir / PIPELINE_OUTPUT_DIRS[output_name]
    if output_name == "variants":
        write_variant_snapshots(pipeline_csv_dir, snapshot_dir)
    else:
        gene_symbol_path = GENE_SYMBOL_PATH_BY_OUTPUT[output_name]
        write_gene_row_snapshots(pipeline_csv_dir, snapshot_dir, gene_symbol_path)
    write_csv_files_snapshot(pipeline_csv_dir, snapshot_dir)


def snapshots_in_scope(directory: Path, symbols: list[str] | None) -> set[str]:
    return {
        path.name
        for path in directory.glob("*.json")
        if symbols is None or path.name.rsplit("-", 1)[0] in symbols
    }


def compare_snapshots(
    golden_dir: Path, fresh_dir: Path, symbols: list[str] | None
) -> bool:
    golden_names = snapshots_in_scope(golden_dir, symbols)
    fresh_names = snapshots_in_scope(fresh_dir, symbols)
    matches = True
    for name in sorted(golden_names | fresh_names):
        if name not in fresh_names:
            print(f"{name}: in golden, missing from this run")
            matches = False
        elif name not in golden_names:
            print(f"{name}: new in this run, not in golden")
            matches = False
        else:
            golden_text = (golden_dir / name).read_text(encoding="utf-8")
            fresh_text = (fresh_dir / name).read_text(encoding="utf-8")
            if golden_text != fresh_text:
                sys.stdout.writelines(
                    difflib.unified_diff(
                        golden_text.splitlines(keepends=True),
                        fresh_text.splitlines(keepends=True),
                        fromfile=f"golden/{name}",
                        tofile=f"this-run/{name}",
                    )
                )
                matches = False
    return matches


def replace_golden_snapshots(
    golden_dir: Path, fresh_dir: Path, symbols: list[str] | None
) -> None:
    golden_dir.mkdir(parents=True, exist_ok=True)
    for name in snapshots_in_scope(golden_dir, symbols):
        (golden_dir / name).unlink()
    for name in snapshots_in_scope(fresh_dir, symbols):
        shutil.copyfile(fresh_dir / name, golden_dir / name)


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-data-root", type=Path, default=REPO_ROOT / "data")
    parser.add_argument(
        "--gnomad-variants-path",
        type=Path,
        help="local gnomAD variants table to use instead of the pipeline's GCS default",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="overwrite the golden snapshots in scope with this run's output",
    )
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument("--symbols", nargs="+", help="only run these fixture genes")
    scope.add_argument(
        "--fast",
        action="store_true",
        help=f"same as --symbols {' '.join(FAST_CHECK_SYMBOLS)}",
    )
    args = parser.parse_args(argv)

    if args.fast:
        args.symbols = FAST_CHECK_SYMBOLS
    known_symbols = {gene["symbol"] for gene in read_fixture_genes()}
    unknown_symbols = sorted(set(args.symbols or []) - known_symbols)
    if unknown_symbols:
        parser.error(f"not in {FIXTURE_GENES_CSV.name}: {', '.join(unknown_symbols)}")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    all_match = True
    with tempfile.TemporaryDirectory(prefix="genie-golden-") as scratch:
        scratch_dir = Path(scratch)
        pipeline_output_dir = run_pipeline(
            scratch_dir, args.source_data_root, args.symbols, args.gnomad_variants_path
        )
        for output_name in PIPELINE_OUTPUT_DIRS:
            golden_dir = GOLDEN_DIR / output_name
            fresh_dir = scratch_dir / "snapshots" / output_name
            write_snapshots(output_name, pipeline_output_dir, fresh_dir)

            print(f"\n== {output_name} ==")
            matches = compare_snapshots(golden_dir, fresh_dir, args.symbols)
            print(f"{output_name}: {'OK' if matches else 'DIFFERS'}")
            all_match = all_match and matches

            if args.update and not matches:
                replace_golden_snapshots(golden_dir, fresh_dir, args.symbols)
                print(f"{output_name}: golden snapshots updated")

    return 0 if all_match or args.update else 1


if __name__ == "__main__":
    sys.exit(main())
