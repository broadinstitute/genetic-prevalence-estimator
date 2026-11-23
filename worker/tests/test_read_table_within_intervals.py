import gzip
import json
import os
from types import SimpleNamespace

import hail as hl
import pytest

from worker.tasks import (
    _custom_variant_ids,
    _import_existing_variants,
    _read_table_within_intervals,
    _transcript_interval,
    _variant_interval,
)

REFERENCE_GENOME = "GRCh38"
GNOMAD_VERSION = "4.1.0"
CONTIGS = ["1", "2", "7", "12", "X"]
POSITIONS = range(1, 2_000_001, 2000)

TRANSCRIPT = {"chrom": "12", "start": 500_001, "stop": 510_001}
GENE_VARIANT_IDS = ["chr12-500001-A-G", "chr12-504001-A-G", "chr12-510001-A-G"]


def custom_variant_list(variant_ids):
    return SimpleNamespace(variants=[{"id": variant_id} for variant_id in variant_ids])


def key_index(locus_json):
    contigs = hl.get_reference(REFERENCE_GENOME).contigs
    return (contigs.index(locus_json["contig"]), locus_json["position"])


def delete_parts_without(table_path, needed_ids):
    metadata = json.load(gzip.open(f"{table_path}/rows/metadata.json.gz"))
    needed_keys = [
        (hl.get_reference(REFERENCE_GENOME).contigs.index(contig), int(position))
        for contig, position, _ref, _alt in (i.split("-") for i in needed_ids)
    ]
    for part_file, bounds in zip(metadata["_partFiles"], metadata["_jRangeBounds"]):
        start = key_index(bounds["start"]["locus"])
        end = key_index(bounds["end"]["locus"])
        if not any(start <= key <= end for key in needed_keys):
            os.remove(f"{table_path}/rows/parts/{part_file}")


@pytest.fixture(scope="module")
def gnomad_like_table_path(tmp_path_factory):
    path = str(tmp_path_factory.mktemp("gnomad") / "variants.ht")
    rows = [
        {
            "locus": hl.Locus(f"chr{contig}", position, REFERENCE_GENOME),
            "alleles": ["A", "G"],
            "AC": position % 7,
        }
        for contig in CONTIGS
        for position in POSITIONS
    ]
    table = hl.Table.parallelize(
        rows,
        hl.tstruct(
            locus=hl.tlocus(REFERENCE_GENOME), alleles=hl.tarray(hl.tstr), AC=hl.tint32
        ),
        n_partitions=100,
    ).key_by("locus", "alleles")
    table.write(path)
    return path


def collect_joined(left, right):
    return sorted(
        (row.id, row.AC)
        for row in left.annotate(**right[left.locus, left.alleles]).collect()
    )


@pytest.mark.parametrize(
    "custom_ids,include_transcript",
    [
        (["1-2001-A-G", "7-4001-A-T", "X-1998001-A-G"], False),
        (["1-2001-A-G", "1-2001-A-G", "X-4001-A-G"], False),
        (["1-2001-A-G", "X-1998001-A-G"], True),
    ],
    ids=["across chromosomes with a missing variant", "duplicates", "with transcript"],
)
def test_join_reads_only_partitions_holding_the_list(
    gnomad_like_table_path, tmp_path, custom_ids, include_transcript
):
    variant_list = custom_variant_list(custom_ids)
    left = _import_existing_variants(variant_list, GNOMAD_VERSION, REFERENCE_GENOME)
    intervals = [
        _variant_interval(variant_id_str, REFERENCE_GENOME)
        for variant_id_str in _custom_variant_ids(variant_list, GNOMAD_VERSION)
    ]
    if include_transcript:
        gene_rows = _import_existing_variants(
            custom_variant_list([i.removeprefix("chr") for i in GENE_VARIANT_IDS]),
            GNOMAD_VERSION,
            REFERENCE_GENOME,
        )
        left = left.join(gene_rows, how="outer")
        intervals.append(_transcript_interval(TRANSCRIPT, REFERENCE_GENOME))
    left = left.annotate(id=hl.str(left.locus) + "-" + hl.delimit(left.alleles, "-"))

    expected = collect_joined(left, hl.read_table(gnomad_like_table_path))

    pruned_path = str(tmp_path / "pruned.ht")
    hl.read_table(gnomad_like_table_path).write(pruned_path)
    needed_ids = _custom_variant_ids(variant_list, GNOMAD_VERSION) + (
        GENE_VARIANT_IDS if include_transcript else []
    )
    delete_parts_without(pruned_path, needed_ids)

    with pytest.raises(Exception, match="does not exist"):
        collect_joined(left, hl.read_table(pruned_path))

    assert (
        collect_joined(left, _read_table_within_intervals(pruned_path, intervals))
        == expected
    )


def test_variant_interval_covers_one_grch37_position():
    interval = _variant_interval("X-1500-C-T", "GRCh37")

    assert interval.start == hl.Locus("X", 1500, "GRCh37")
    assert interval.end == interval.start
    assert interval.includes_start and interval.includes_end
