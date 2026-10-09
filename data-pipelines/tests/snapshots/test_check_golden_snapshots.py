from check_golden_snapshots import compare_snapshot_dirs


def write_json(path, text):
    path.write_text(text, encoding="utf-8")


def test_identical_directories_match(tmp_path):
    golden_dir = tmp_path / "golden"
    fresh_dir = tmp_path / "fresh"
    golden_dir.mkdir()
    fresh_dir.mkdir()
    write_json(golden_dir / "PCSK9-ENSG1.json", '{"type": "AD"}')
    write_json(fresh_dir / "PCSK9-ENSG1.json", '{"type": "AD"}')

    result = compare_snapshot_dirs(golden_dir, fresh_dir)

    assert result.matches


def test_gene_missing_from_fresh_run_is_reported(tmp_path):
    golden_dir = tmp_path / "golden"
    fresh_dir = tmp_path / "fresh"
    golden_dir.mkdir()
    fresh_dir.mkdir()
    write_json(golden_dir / "PCSK9-ENSG1.json", '{"type": "AD"}')

    result = compare_snapshot_dirs(golden_dir, fresh_dir)

    assert not result.matches
    assert result.only_in_golden == ["PCSK9-ENSG1.json"]
    assert result.only_in_fresh == []


def test_new_gene_in_fresh_run_is_reported(tmp_path):
    golden_dir = tmp_path / "golden"
    fresh_dir = tmp_path / "fresh"
    golden_dir.mkdir()
    fresh_dir.mkdir()
    write_json(fresh_dir / "ARG1-ENSG2.json", '{"type": "AR"}')

    result = compare_snapshot_dirs(golden_dir, fresh_dir)

    assert not result.matches
    assert result.only_in_fresh == ["ARG1-ENSG2.json"]
    assert result.only_in_golden == []


def test_content_difference_is_reported_with_a_readable_diff(tmp_path):
    golden_dir = tmp_path / "golden"
    fresh_dir = tmp_path / "fresh"
    golden_dir.mkdir()
    fresh_dir.mkdir()
    write_json(golden_dir / "PCSK9-ENSG1.json", '{\n  "type": "AD"\n}')
    write_json(fresh_dir / "PCSK9-ENSG1.json", '{\n  "type": "AR"\n}')

    result = compare_snapshot_dirs(golden_dir, fresh_dir)

    assert not result.matches
    assert result.only_in_golden == []
    assert result.only_in_fresh == []
    assert "PCSK9-ENSG1.json" in result.differing
    assert '-  "type": "AD"' in result.differing["PCSK9-ENSG1.json"]
    assert '+  "type": "AR"' in result.differing["PCSK9-ENSG1.json"]
