import logging
import traceback
import uuid

import hail as hl
from django.conf import settings

from calculator.models import VariantList


logger = logging.getLogger(__name__)


PLOF_VEP_CONSEQUENCE_TERMS = hl.set(
    [
        "transcript_ablation",
        "splice_acceptor_variant",
        "splice_donor_variant",
        "stop_gained",
        "frameshift_variant",
    ]
)


def initialize_hail():
    hl.init(
        idempotent=True,
        local="local[1]",
        log=settings.HAIL_LOG_PATH,
        quiet=not settings.DEBUG,
    )


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


def get_gnomad_variant_list(variant_list):
    transcript_id = variant_list.metadata["transcript_id"]
    gnomad_version = variant_list.metadata["gnomad_version"]
    assert gnomad_version in (
        "2.1.1",
        "3.1.1",
    ), f"Invalid gnomAD version '{gnomad_version}'"

    ds = hl.read_table(
        f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_variant_lists.ht"
    )
    ds = ds.filter(ds.transcript_id == transcript_id)

    ds = ds.key_by()
    ds = ds.explode(ds.variants, name="variant")
    ds = ds.annotate(**ds.variant)

    should_include_variant = PLOF_VEP_CONSEQUENCE_TERMS.contains(
        ds.transcript_consequence.major_consequence
    ) & (ds.transcript_consequence.lof == "HC")

    if variant_list.metadata["included_clinvar_variants"]:
        reference_genome = ds.locus.dtype.reference_genome.name
        assert reference_genome in ("GRCh37", "GRCh38")

        include_clinvar_variant_categories = hl.set(
            variant_list.metadata["included_clinvar_variants"]
        )
        clinvar = hl.read_table(
            f"{settings.CLINVAR_DATA_PATH}/ClinVar_{reference_genome}_variants.ht"
        )

        variant_list.metadata["clinvar_version"] = hl.eval(clinvar.globals.release_date)

        should_include_variant = (
            should_include_variant
            | include_clinvar_variant_categories.contains(
                clinvar[ds.locus, ds.alleles].clinical_significance_category
            )
        )

    ds = ds.filter(should_include_variant)

    ds = ds.select(id=variant_id(ds.locus, ds.alleles))

    variants = [dict(variant) for variant in ds.collect()]
    variant_list.variants = variants
    variant_list.save()


def process_new_variant_list(uid):
    logger.info("Processing new variant list %s", uid)

    variant_list = VariantList.objects.get(uuid=uid)
    variant_list.status = VariantList.Status.PROCESSING
    variant_list.save()

    try:
        if variant_list.type == VariantList.Type.GNOMAD:
            get_gnomad_variant_list(variant_list)

    except Exception:  # pylint: disable=broad-except
        logger.exception("Error processing new variant list %s", uid)

        variant_list.refresh_from_db()
        variant_list.status = VariantList.Status.ERROR
        variant_list.error = traceback.format_exc()
        variant_list.save()

    else:
        logger.info("Done processing new variant list %s", uid)

        variant_list.status = VariantList.Status.READY
        variant_list.save()


def handle_event(event):
    try:
        event_type = event["type"]
        args = event["args"]

        if event_type == "new_variant_list":
            process_new_variant_list(uuid.UUID(hex=args["uuid"]))

    except KeyError:
        logger.error("Invalid event %s", event)
