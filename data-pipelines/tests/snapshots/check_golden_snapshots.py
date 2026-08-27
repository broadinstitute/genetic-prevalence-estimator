"""
Used to run the pipeline with real data and generate the same set of json snapshots to check against the saved 'golden' truth state snapshots.

Usage:

    uv run python data-pipelines/tests/snapshots/check_golden_snapshots.py \\
        [--source-data-root ./data]

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

    @property
    def matches(self) -> bool:
        return not (self.only_in_golden or self.only_in_fresh or self.differing)


def compare_snapshot_dirs(golden_dir: Path, fresh_dir: Path) -> SnapshotComparison:
    golden_files = {p.name for p in golden_dir.glob("*.json")}
    fresh_files = {p.name for p in fresh_dir.glob("*.json")}

    result = SnapshotComparison(
        only_in_golden=sorted(golden_files - fresh_files),
        only_in_fresh=sorted(fresh_files - golden_files),
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


def print_report(result: SnapshotComparison, golden_dir: Path) -> None:
    if result.matches:
        golden_count = len(list(golden_dir.glob("*.json")))
        print(
            f"all good! pipeline output matches all {golden_count} golden snapshot(s)."
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
    args = parser.parse_args(argv)

    with tempfile.TemporaryDirectory(prefix="genie-golden-check-") as scratch:
        models_dir = run_pipeline(args.source_data_root, Path(scratch))
        fresh_snapshots_dir = Path(scratch) / "fresh_snapshots"
        generate_snapshots(
            models_dir, fresh_snapshots_dir, filename_field="metadata.gene_symbol"
        )
        result = compare_snapshot_dirs(SNAPSHOTS_DIR, fresh_snapshots_dir)

    print_report(result, SNAPSHOTS_DIR)
    return 0 if result.matches else 1


if __name__ == "__main__":
    sys.exit(main())
