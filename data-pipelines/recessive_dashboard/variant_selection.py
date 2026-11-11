import gc
import json

import hail as hl

from recessive_dashboard.variant_flags_and_frequencies import (
    VARIANT_FLAG_CALCULATION_FIELDS,
)


PLOF_VEP_CONSEQUENCE_TERMS = hl.set(
    [
        "transcript_ablation",
        "splice_acceptor_variant",
        "splice_donor_variant",
        "stop_gained",
        "frameshift_variant",
    ]
)


VARIANT_FIELDS = [
    "id",
    # Consequence
    "hgvsc",
    "hgvsp",
    "lof",
    "major_consequence",
    "gene_id",
    "gene_symbol",
    "transcript_id",
    # Frequency
    "AC",
    "AN",
    "homozygote_count",
    # ClinVar
    "clinvar_variation_id",
    "clinical_significance",
    "gold_stars",
    # Other
    "filters",
    "flags",
    "sample_sets",
    "source",
    # LoF curation
    "lof_curation",
]


def variant_id(locus, alleles):
    return (
        locus.contig.replace("^chr", "")
        + "-"
        + hl.str(locus.position)
        + "-"
        + alleles[0]
        + "-"
        + alleles[1]
    )


def _annotate_with_gnomad(contig, start, stop, transcript_id, gnomad_variants):
    ht = hl.filter_intervals(
        gnomad_variants,
        [
            hl.interval(
                hl.locus(contig, start, "GRCh38"),
                hl.locus(contig, stop, "GRCh38"),
                includes_start=True,
                includes_end=True,
            )
        ],
    )

    ht = ht.transmute(
        transcript_consequence=ht.transcript_consequences.find(
            lambda csq: csq.transcript_id == transcript_id
        )
    )

    ht = ht.filter(hl.is_defined(ht.transcript_consequence))
    ht = ht.transmute(**ht.transcript_consequence)

    include_from_gnomad = PLOF_VEP_CONSEQUENCE_TERMS.contains(ht.major_consequence) & (
        ht.lof == "HC"
    )

    ht = ht.annotate(include_from_gnomad=include_from_gnomad)

    return ht


# These should be kept in sync with the classifications in import_clinvar.py.
CLINVAR_PATHOGENIC_CLASSIFICATIONS = [
    "Likely pathogenic",
    "Likely pathogenic/Likely risk allele",
    "Likely pathogenic/Pathogenic",
    "Pathogenic",
    "Pathogenic/Pathogenic",
    "Pathogenic/Likely pathogenic",
    "Pathogenic/Likely pathogenic/Likely risk allele",
    "Pathogenic/Likely pathogenic/Pathogenic",
]
CLINVAR_BENIGN_CLASSIFICATIONS = [
    "Benign",
    "Benign/Likely benign",
    "Likely benign",
]


def _annotate_with_clinvar(ht):
    pathogenic_significance = (
        ht.clinvar.clinical_significance_category == "pathogenic_or_likely_pathogenic"
    )
    primary_report_is_path = hl.literal(CLINVAR_PATHOGENIC_CLASSIFICATIONS).contains(
        ht.clinvar.clinical_significance[0]
    )

    return ht.annotate(
        include_from_clinvar=pathogenic_significance & primary_report_is_path
    )


def _remove_clinvar_primary_benign_classifications(ht):
    primary_report_is_benign = hl.literal(CLINVAR_BENIGN_CLASSIFICATIONS).contains(
        ht.clinvar.clinical_significance[0]
    )

    return ht.filter(~primary_report_is_benign)


def collect_gene_variants(
    transcript_id,
    start,
    stop,
    chrom,
    gnomad_variants,
    clinvar_variants,
):
    contig = f"chr{chrom}"

    ht = _annotate_with_gnomad(contig, start, stop, transcript_id, gnomad_variants)

    ht = ht.annotate(clinvar=clinvar_variants[ht.locus, ht.alleles])

    ht = _annotate_with_clinvar(ht)

    ht = ht.filter(ht.include_from_gnomad | ht.include_from_clinvar)

    ht = _remove_clinvar_primary_benign_classifications(ht)

    ht = ht.transmute(
        source=hl.array(
            [
                hl.or_missing(ht.include_from_gnomad, "gnomAD"),
                hl.or_missing(ht.include_from_clinvar, "ClinVar"),
            ]
        ).filter(hl.is_defined)
    )

    ht = ht.annotate(id=variant_id(ht.locus, ht.alleles))

    ht = ht.annotate(**ht.freq.joint)

    ht = ht.transmute(
        **ht.clinvar.select(
            "clinvar_variation_id",
            "clinical_significance",
            "clinical_significance_category",
            "gold_stars",
        )
    )

    ht = ht.annotate(_freq_missing=hl.is_missing(ht.freq))

    # TODO: lof curation for v2, later for v4
    table_fields = set(ht.row)
    select_fields = [field for field in VARIANT_FIELDS if field in table_fields]
    temp_fields_for_flags = [
        field for field in VARIANT_FLAG_CALCULATION_FIELDS if field in table_fields
    ]
    ht = ht.select(*select_fields, *temp_fields_for_flags)

    variants = [json.loads(variant) for variant in hl.json(ht.row_value).collect()]

    del ht
    gc.collect()

    return variants
