"""
Turn specified rows from the output CSV of the pipeline into sorted, parsed json files for usage in data snapshot testing
"""

import csv
import json
from pathlib import Path

DATE_CREATED_COLUMN = "date_created"


def find_csv_files(input_path: Path) -> list[Path]:
    if input_path.is_dir():
        return sorted(input_path.glob("*.csv"))
    return [input_path]


def load_rows(input_path: Path, key_column: str) -> dict[str, dict[str, str]]:
    """Raises if the same key appears twice with different row contents - that
    means two input files disagree about the same row, which is always worth
    surfacing rather than silently picking one.
    """
    rows_by_key: dict[str, dict[str, str]] = {}
    for csv_path in find_csv_files(input_path):
        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                key = row[key_column]
                if key in rows_by_key and rows_by_key[key] != row:
                    raise ValueError(
                        f"conflicting rows for {key_column}={key!r}: seen in an "
                        f"earlier file and again in {csv_path}, with different contents"
                    )
                rows_by_key[key] = row
    return rows_by_key


def parse_json_cells(row: dict[str, str]) -> dict:
    parsed = {}
    for column, value in row.items():
        try:
            json_value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            parsed[column] = value
            continue
        parsed[column] = json_value if isinstance(json_value, (dict, list)) else value
    return parsed


def resolve_field(record: dict, dotted_path: str) -> str | None:
    value = record
    for part in dotted_path.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def generate_snapshots(
    input_path: Path,
    output_dir: Path,
    key_column: str = "gene_id",
    include_date_created: bool = False,
    filename_field: str | None = None,
) -> list[Path]:
    rows_by_key = load_rows(input_path, key_column)

    output_dir.mkdir(parents=True, exist_ok=True)
    for stale in output_dir.glob("*.json"):
        stale.unlink()

    written = []
    for key, row in sorted(rows_by_key.items()):
        record = parse_json_cells(row)
        if not include_date_created:
            record.pop(DATE_CREATED_COLUMN, None)

        prefix_value = resolve_field(record, filename_field) if filename_field else None
        filename = f"{prefix_value}-{key}.json" if prefix_value else f"{key}.json"

        snapshot_path = output_dir / filename
        with open(snapshot_path, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, sort_keys=True)
            f.write("\n")
        written.append(snapshot_path)

    return written
