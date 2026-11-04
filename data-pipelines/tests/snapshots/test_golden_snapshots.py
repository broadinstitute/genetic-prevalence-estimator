import json

import pytest

from golden_snapshots import (
    compare_snapshots,
    replace_golden_snapshots,
    write_snapshots,
)

MODELS_CSV = (
    "gene_id,date_created,metadata,type,count\n"
    'ENSG1,2026-01-01,"{""gene_symbol"": ""PCSK9"", ""b"": 1}",AD,0.5\n'
)


def make_dir(tmp_path, name, files):
    directory = tmp_path / name
    directory.mkdir()
    for filename, text in files.items():
        (directory / filename).write_text(text, encoding="utf-8")
    return directory


def test_write_snapshots_writes_one_canonical_file_per_gene(tmp_path):
    csv_dir = make_dir(tmp_path, "csv", {"batch-1.csv": MODELS_CSV})

    write_snapshots(csv_dir, tmp_path / "out", ["metadata", "gene_symbol"])

    text = (tmp_path / "out" / "PCSK9-ENSG1.json").read_text(encoding="utf-8")
    assert json.loads(text) == {
        "count": "0.5",
        "gene_id": "ENSG1",
        "metadata": {"b": 1, "gene_symbol": "PCSK9"},
        "type": "AD",
    }
    assert text == json.dumps(json.loads(text), indent=2, sort_keys=True) + "\n"


def test_write_snapshots_rejects_conflicting_rows_for_one_gene(tmp_path):
    csv_dir = make_dir(
        tmp_path,
        "csv",
        {"batch-1.csv": MODELS_CSV, "batch-2.csv": MODELS_CSV.replace(",AD,", ",AR,")},
    )

    with pytest.raises(ValueError):
        write_snapshots(csv_dir, tmp_path / "out", ["metadata", "gene_symbol"])


def test_compare_snapshots_reports_changed_missing_and_new_files(tmp_path, capsys):
    golden = make_dir(tmp_path, "golden", {"A-E1.json": "1\n", "B-E2.json": "x\n"})
    fresh = make_dir(tmp_path, "fresh", {"A-E1.json": "2\n", "C-E3.json": "y\n"})

    assert not compare_snapshots(golden, fresh, None)
    output = capsys.readouterr().out
    assert "-1" in output and "+2" in output
    assert "B-E2.json: in golden, missing from this run" in output
    assert "C-E3.json: new in this run, not in golden" in output


def test_compare_snapshots_ignores_genes_outside_symbols(tmp_path):
    golden = make_dir(tmp_path, "golden", {"A-E1.json": "1\n", "B-E2.json": "x\n"})
    fresh = make_dir(tmp_path, "fresh", {"A-E1.json": "1\n"})

    assert compare_snapshots(golden, fresh, ["A"])


def test_replace_golden_snapshots_only_touches_genes_in_symbols(tmp_path):
    golden = make_dir(tmp_path, "golden", {"A-E1.json": "1\n", "B-E2.json": "x\n"})
    fresh = make_dir(tmp_path, "fresh", {"A-E1.json": "2\n", "B-E2.json": "y\n"})

    replace_golden_snapshots(golden, fresh, ["A"])

    assert (golden / "A-E1.json").read_text() == "2\n"
    assert (golden / "B-E2.json").read_text() == "x\n"
