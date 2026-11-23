import hail as hl

from worker.tasks import _annotate_variants_with_flags

PLP = "pathogenic_or_likely_pathogenic"

VARIANT_TYPE = hl.tstruct(
    freq=hl.tstruct(),
    filters=hl.tstruct(exome=hl.tset(hl.tstr), genome=hl.tset(hl.tstr)),
    AC=hl.tarray(hl.tint32),
    AN=hl.tarray(hl.tint32),
    homozygote_count=hl.tarray(hl.tint32),
    clinvar_variation_id=hl.tstr,
    clinical_significance_category=hl.tstr,
)


def variant(ac, an, category=None, clinvar_variation_id=None):
    return hl.Struct(
        freq=hl.Struct(),
        filters=None,
        AC=[ac],
        AN=[an],
        homozygote_count=[0],
        clinvar_variation_id=clinvar_variation_id,
        clinical_significance_category=category,
    )


def flags_of(*variants):
    annotated = _annotate_variants_with_flags(
        hl.literal(list(variants), hl.tarray(VARIANT_TYPE))
    )
    return [list(v.flags) for v in hl.eval(annotated)]


def test_high_af_is_relative_to_most_common_pathogenic_variant():
    assert flags_of(
        variant(10, 1000, PLP, clinvar_variation_id="1"),
        variant(20, 1000),
        variant(5, 1000),
    ) == [[], ["high_AF"], []]


def test_pathogenic_variant_with_zero_an_does_not_disable_high_af():
    assert flags_of(
        variant(0, 0, PLP, clinvar_variation_id="1"),
        variant(10, 1000, PLP, clinvar_variation_id="2"),
        variant(20, 1000),
    ) == [["low_AN"], [], ["high_AF"]]


def test_no_high_af_without_pathogenic_variants():
    assert flags_of(variant(999, 1000), variant(1, 1000)) == [[], []]


def test_low_an_is_relative_to_largest_an_ignoring_missing():
    assert flags_of(variant(0, 1000), variant(0, 499), variant(0, None)) == [
        [],
        ["low_AN"],
        [],
    ]
