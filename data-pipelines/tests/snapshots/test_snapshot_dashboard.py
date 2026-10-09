import csv
import json

import pytest

from snapshot_dashboard import generate_snapshots


FIELDNAMES = ["gene_id", "label", "date_created", "metadata", "type"]


def write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def row(gene_id, date_created="2026-01-01T00:00:00.000000", metadata=None, type_="AR"):
    return {
        "gene_id": gene_id,
        "label": f"{gene_id} - Dashboard",
        "date_created": date_created,
        "metadata": json.dumps(metadata or {"gene_id": gene_id}),
        "type": type_,
    }


def read_snapshot(output_dir, gene_id):
    with open(output_dir / f"{gene_id}.json", encoding="utf-8") as f:
        return json.load(f), f.read()


def test_writes_one_file_per_row(tmp_path):
    csv_path = tmp_path / "input.csv"
    write_csv(csv_path, [row("ENSG1"), row("ENSG2")])
    output_dir = tmp_path / "snapshots"

    written = generate_snapshots(csv_path, output_dir)

    assert {p.name for p in written} == {"ENSG1.json", "ENSG2.json"}


def test_date_created_dropped_by_default(tmp_path):
    csv_path = tmp_path / "input.csv"
    write_csv(csv_path, [row("ENSG1")])
    output_dir = tmp_path / "snapshots"

    generate_snapshots(csv_path, output_dir)

    record, _ = read_snapshot(output_dir, "ENSG1")
    assert "date_created" not in record


def test_date_created_kept_when_requested(tmp_path):
    csv_path = tmp_path / "input.csv"
    write_csv(csv_path, [row("ENSG1", date_created="2026-01-01T00:00:00.000000")])
    output_dir = tmp_path / "snapshots"

    generate_snapshots(csv_path, output_dir, include_date_created=True)

    record, _ = read_snapshot(output_dir, "ENSG1")
    assert record["date_created"] == "2026-01-01T00:00:00.000000"


def test_json_cells_are_expanded_not_left_as_strings(tmp_path):
    csv_path = tmp_path / "input.csv"
    write_csv(
        csv_path,
        [row("ENSG1", metadata={"gene_symbol": "PCSK9", "gnomad_version": "4.1.1"})],
    )
    output_dir = tmp_path / "snapshots"

    generate_snapshots(csv_path, output_dir)

    record, _ = read_snapshot(output_dir, "ENSG1")
    assert record["metadata"] == {"gene_symbol": "PCSK9", "gnomad_version": "4.1.1"}


def test_key_order_does_not_affect_output_bytes(tmp_path):
    csv_a = tmp_path / "a.csv"
    csv_b = tmp_path / "b.csv"
    write_csv(csv_a, [row("ENSG1", metadata={"a": 1, "b": 2})])
    write_csv(csv_b, [row("ENSG1", metadata={"b": 2, "a": 1})])
    output_a = tmp_path / "snapshots_a"
    output_b = tmp_path / "snapshots_b"

    generate_snapshots(csv_a, output_a)
    generate_snapshots(csv_b, output_b)

    _, text_a = read_snapshot(output_a, "ENSG1")
    _, text_b = read_snapshot(output_b, "ENSG1")
    assert text_a == text_b


def test_directory_input_merges_all_csv_files(tmp_path):
    input_dir = tmp_path / "batches"
    input_dir.mkdir()
    write_csv(input_dir / "batch-0.csv", [row("ENSG1")])
    write_csv(input_dir / "batch-1.csv", [row("ENSG2")])
    output_dir = tmp_path / "snapshots"

    written = generate_snapshots(input_dir, output_dir)

    assert {p.name for p in written} == {"ENSG1.json", "ENSG2.json"}


def test_conflicting_rows_across_files_raise(tmp_path):
    input_dir = tmp_path / "batches"
    input_dir.mkdir()
    write_csv(input_dir / "batch-0.csv", [row("ENSG1", type_="AR")])
    write_csv(input_dir / "batch-1.csv", [row("ENSG1", type_="AD")])
    output_dir = tmp_path / "snapshots"

    with pytest.raises(ValueError):
        generate_snapshots(input_dir, output_dir)


def test_identical_rows_across_files_do_not_raise(tmp_path):
    input_dir = tmp_path / "batches"
    input_dir.mkdir()
    write_csv(input_dir / "batch-0.csv", [row("ENSG1")])
    write_csv(input_dir / "batch-1.csv", [row("ENSG1")])
    output_dir = tmp_path / "snapshots"

    written = generate_snapshots(input_dir, output_dir)

    assert {p.name for p in written} == {"ENSG1.json"}


def test_stale_snapshots_are_removed_on_regeneration(tmp_path):
    output_dir = tmp_path / "snapshots"
    output_dir.mkdir()
    (output_dir / "STALE_GENE.json").write_text("{}", encoding="utf-8")

    csv_path = tmp_path / "input.csv"
    write_csv(csv_path, [row("ENSG1")])

    generate_snapshots(csv_path, output_dir)

    assert not (output_dir / "STALE_GENE.json").exists()
    assert (output_dir / "ENSG1.json").exists()


def test_filename_field_prefixes_the_output_filename(tmp_path):
    csv_path = tmp_path / "input.csv"
    write_csv(csv_path, [row("ENSG1", metadata={"gene_symbol": "PCSK9"})])
    output_dir = tmp_path / "snapshots"

    written = generate_snapshots(
        csv_path, output_dir, filename_field="metadata.gene_symbol"
    )

    assert {p.name for p in written} == {"PCSK9-ENSG1.json"}


def test_filename_field_falls_back_to_key_when_field_missing(tmp_path):
    csv_path = tmp_path / "input.csv"
    write_csv(csv_path, [row("ENSG1", metadata={"no_gene_symbol_here": True})])
    output_dir = tmp_path / "snapshots"

    written = generate_snapshots(
        csv_path, output_dir, filename_field="metadata.gene_symbol"
    )

    assert {p.name for p in written} == {"ENSG1.json"}
