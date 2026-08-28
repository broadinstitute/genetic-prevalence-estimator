"""
Used to run the pipeline with real data and generate the same set of json snapshots to check against the saved 'golden' truth state snapshots.

Usage:

    uv run python data-pipelines/tests/snapshots/check_golden_snapshots.py \\
        [--source-data-root ./data] [--symbols SYMBOL [SYMBOL ...]]

--symbols restricts the check to a subset of GOLDEN_FIXTURE_GENES (see
generate_golden_snapshots.py), e.g. `--symbols PCSK9` for a single-gene,
single-chromosome, single-batch run -- much faster than the full fixture set
for iterating locally, at the cost of covering only that gene's code paths.
"""

import argparse
import difflib
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from generate_golden_snapshots import REPO_ROOT, SNAPSHOTS_DIR, run_pipeline
from snapshot_dashboard import generate_snapshots


@dataclass
class SnapshotComparison:
    only_in_golden: list[str] = field(default_factory=list)
    only_in_fresh: list[str] = field(default_factory=list)
    differing: dict[str, str] = field(default_factory=dict)
    compared_count: int = 0

    @property
    def matches(self) -> bool:
        return not (self.only_in_golden or self.only_in_fresh or self.differing)


def compare_snapshot_dirs(
    golden_dir: Path, fresh_dir: Path, symbols: list[str] | None = None
) -> SnapshotComparison:
    def in_scope(filename: str) -> bool:
        return symbols is None or any(
            filename.startswith(f"{symbol}-") for symbol in symbols
        )

    golden_files = {p.name for p in golden_dir.glob("*.json") if in_scope(p.name)}
    fresh_files = {p.name for p in fresh_dir.glob("*.json") if in_scope(p.name)}

    result = SnapshotComparison(
        only_in_golden=sorted(golden_files - fresh_files),
        only_in_fresh=sorted(fresh_files - golden_files),
        compared_count=len(golden_files),
    )

    for name in sorted(golden_files & fresh_files):
        golden_text = (golden_dir / name).read_text(encoding="utf-8")
        fresh_text = (fresh_dir / name).read_text(encoding="utf-8")
        if golden_text == fresh_text:
            continue
        result.differing[name] = "".join(
            difflib.unified_diff(
                golden_text.splitlines(keepends=True),
                fresh_text.splitlines(keepends=True),
                fromfile=f"golden/{name}",
                tofile=f"pipeline-run/{name}",
            )
        )

    return result


def print_report(result: SnapshotComparison) -> None:
    if result.matches:
        print(
            f"all good! pipeline output matches all {result.compared_count} golden "
            "snapshot(s)."
        )
        return

    print("bad: pipeline output differs from the golden snapshots.")
    if result.only_in_golden:
        print(
            f"  {len(result.only_in_golden)} gene(s) in golden but missing from this run: "
            f"{', '.join(result.only_in_golden)}"
        )
    if result.only_in_fresh:
        print(
            f"  {len(result.only_in_fresh)} gene(s) produced now but not in golden: "
            f"{', '.join(result.only_in_fresh)}"
        )
    for name, diff in result.differing.items():
        print(f"\n--- {name} ---")
        print(diff)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-data-root", type=Path, default=REPO_ROOT / "data")
    parser.add_argument(
        "--symbols",
        nargs="+",
        default=None,
        help="Only check these golden fixture gene(s) (space-separated symbols), "
        "instead of the full GOLDEN_FIXTURE_GENES set.",
    )
    args = parser.parse_args(argv)

    with tempfile.TemporaryDirectory(prefix="genie-golden-check-") as scratch:
        models_dir = run_pipeline(
            args.source_data_root, Path(scratch), symbols=args.symbols
        )
        fresh_snapshots_dir = Path(scratch) / "fresh_snapshots"
        generate_snapshots(
            models_dir, fresh_snapshots_dir, filename_field="metadata.gene_symbol"
        )
        result = compare_snapshot_dirs(
            SNAPSHOTS_DIR, fresh_snapshots_dir, symbols=args.symbols
        )

    print_report(result)
    return 0 if result.matches else 1


if __name__ == "__main__":
    sys.exit(main())
