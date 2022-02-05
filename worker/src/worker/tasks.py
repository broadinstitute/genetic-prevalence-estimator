import json
import logging
import traceback
import uuid

import hail as hl
import requests
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


VARIANT_FIELDS = [
    "id",
    # Consequence
    "hgvsc",
    "hgvsp",
    "lof",
    "major_consequence",
    # Frequency
    "AC",
    "AN",
    # ClinVar
    "clinvar_variation_id",
    "clinical_significance",
    # Other
    "flags",
]


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


def parse_variant_id(variant_id_str, reference_genome):
    assert reference_genome in ("GRCh37", "GRCh38")

    return hl.rbind(
        variant_id_str.split("-"),
        lambda parts: hl.struct(
            locus=hl.locus(
                parts[0], hl.int(parts[1]), reference_genome=reference_genome
            ),
            alleles=[parts[2], parts[3]],
        ),
    )


def combined_freq(ds, n_populations, include_filtered=False):
    zeroes = hl.range(1 + n_populations).map(lambda _: 0)
    return hl.struct(
        **{
            field: hl.zip(
                *(
                    hl.if_else(
                        hl.is_defined(ds.freq[sample_set])
                        & (
                            hl.literal(True)
                            if include_filtered
                            else (
                                hl.len(
                                    hl.or_else(
                                        ds.filters[sample_set], hl.empty_set(hl.tstr)
                                    )
                                )
                                == 0
                            )
                        ),
                        ds.freq[sample_set][field],
                        zeroes,
                    )
                    for sample_set in ("exome", "genome")
                )
            ).map(lambda f: f[0] + f[1])
            for field in ("AC", "AN")
        }
    )


def flags(ds):
    return hl.array(
        [
            hl.or_missing(hl.is_missing(ds.freq), "not_found"),
            hl.or_missing(
                hl.len(
                    hl.or_else(ds.filters.exome, hl.empty_set(hl.tstr)).union(
                        hl.or_else(ds.filters.genome, hl.empty_set(hl.tstr))
                    )
                )
                > 0,
                "filtered",
            ),
        ]
    ).filter(hl.is_defined)


def fetch_transcript(transcript_id, gnomad_version):
    query = """
    query Transcript($transcript_id: String!, $reference_genome: ReferenceGenomeId!) {
        transcript(transcript_id: $transcript_id, reference_genome: $reference_genome) {
            transcript_id
            transcript_version
            gene {
                gene_id
                gene_version
            }
        }
    }
    """

    variables = {
        "transcript_id": transcript_id,
        "reference_genome": "GRCh37"
        if gnomad_version.split(".")[0] == "2"
        else "GRCh38",
    }

    for _ in range(3):
        try:
            response = requests.post(
                "https://gnomad.broadinstitute.org/api",
                json={"query": query, "variables": variables},
                headers={"content-type": "application/json"},
            )

            response = json.loads(response.text)

            errors = response.get("errors", [])
            if errors:
                raise Exception(
                    f"Error in response: {','.join(error['message'] for error in errors)}"
                )

            return response["data"]["transcript"]

        except Exception:  # pylint: disable=broad-except
            pass

    raise Exception("Failed to fetch transcript.")


def validate_recommended_variant_list(variant_list):
    gnomad_version = variant_list.metadata["gnomad_version"]
    assert gnomad_version in (
        "2.1.1",
        "3.1.2",
    ), f"Invalid gnomAD version '{gnomad_version}'"

    transcript_id, transcript_version = variant_list.metadata["transcript_id"].split(
        "."
    )
    gene_id, gene_version = variant_list.metadata["gene_id"].split(".")

    try:
        transcript = fetch_transcript(transcript_id, gnomad_version)
        assert (
            transcript_version == transcript["transcript_version"]
        ), f"Requested transcript version ({transcript_version}) differs from version in gnomAD ({transcript['transcript_version']})"

        assert (
            gene_id == transcript["gene"]["gene_id"]
        ), f"Requested gene ({gene_id}) does not match the gene associated with transcript {transcript_id} in gnomAD ({transcript['gene']['gene_id']})"

        assert (
            gene_version == transcript["gene"]["gene_version"]
        ), f"Requested gene version ({gene_version}) differs from version in gnomAD ({transcript['gene']['gene_version']})"

    except Exception as e:  # pylint: disable=broad-except
        raise Exception("Unable to validate transcript and gene") from e


def process_new_recommended_variant_list(variant_list):
    validate_recommended_variant_list(variant_list)

    transcript_id = variant_list.metadata["transcript_id"].split(".")[0]
    gnomad_version = variant_list.metadata["gnomad_version"]

    ds = hl.read_table(
        f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_transcript_variant_lists.ht"
    )
    ds = ds.filter(ds.transcript_id == transcript_id)

    ds = ds.key_by()
    ds = ds.explode(ds.variants, name="variant")
    ds = ds.annotate(**ds.variant)

    gnomad = hl.read_table(
        f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_variants.ht"
    )
    ds = ds.annotate(**gnomad[ds.locus, ds.alleles])
    ds = ds.transmute(
        **ds.transcript_consequences.find(
            lambda csq: csq.transcript_id == transcript_id
        )
    )

    should_include_variant = PLOF_VEP_CONSEQUENCE_TERMS.contains(
        ds.major_consequence
    ) & (ds.lof == "HC")

    reference_genome = ds.locus.dtype.reference_genome.name
    assert reference_genome in ("GRCh37", "GRCh38")
    clinvar = hl.read_table(
        f"{settings.CLINVAR_DATA_PATH}/ClinVar_{reference_genome}_variants.ht"
    )
    variant_list.metadata["clinvar_version"] = hl.eval(clinvar.globals.release_date)

    if variant_list.metadata["included_clinvar_variants"]:
        include_clinvar_variant_categories = hl.set(
            variant_list.metadata["included_clinvar_variants"]
        )

        should_include_variant = (
            should_include_variant
            | include_clinvar_variant_categories.contains(
                clinvar[ds.locus, ds.alleles].clinical_significance_category
            )
        )

    ds = ds.filter(should_include_variant)

    populations = hl.eval(gnomad.globals.populations)
    variant_list.metadata["populations"] = populations

    ds = ds.annotate(**combined_freq(ds, n_populations=len(populations)))
    ds = ds.annotate(flags=flags(ds))
    ds = ds.drop("freq", "filters")

    ds = ds.annotate(
        **clinvar[ds.locus, ds.alleles].select(
            "clinvar_variation_id", "clinical_significance"
        )
    )

    ds = ds.annotate(id=variant_id(ds.locus, ds.alleles))

    ds = ds.select(*(field for field in VARIANT_FIELDS if field in set(ds.row)))

    variants = [dict(variant) for variant in ds.collect()]
    variant_list.variants = variants
    variant_list.save()


def process_new_custom_variant_list(variant_list):
    reference_genome = variant_list.metadata["reference_genome"]

    gnomad_version = variant_list.metadata["gnomad_version"]
    assert gnomad_version in (
        "2.1.1",
        "3.1.2",
    ), f"Invalid gnomAD version '{gnomad_version}'"

    ds = hl.Table.parallelize(variant_list.variants, hl.tstruct(id=hl.tstr))

    ds = ds.annotate(**parse_variant_id(ds.id, reference_genome))

    gnomad = hl.read_table(
        f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_variants.ht"
    )
    ds = ds.annotate(**gnomad[ds.locus, ds.alleles])
    ds = ds.transmute(**ds.transcript_consequences.first())

    populations = hl.eval(gnomad.globals.populations)
    variant_list.metadata["populations"] = populations

    ds = ds.annotate(**combined_freq(ds, n_populations=len(populations)))
    ds = ds.annotate(flags=flags(ds))
    ds = ds.drop("freq", "filters")

    clinvar = hl.read_table(
        f"{settings.CLINVAR_DATA_PATH}/ClinVar_{reference_genome}_variants.ht"
    )
    variant_list.metadata["clinvar_version"] = hl.eval(clinvar.globals.release_date)

    ds = ds.annotate(
        **clinvar[ds.locus, ds.alleles].select(
            "clinvar_variation_id", "clinical_significance"
        )
    )

    ds = ds.select(*(field for field in VARIANT_FIELDS if field in set(ds.row)))

    variants = [dict(variant) for variant in ds.collect()]
    variant_list.variants = variants
    variant_list.save()


def process_new_variant_list(uid):
    logger.info("Processing new variant list %s", uid)

    variant_list = VariantList.objects.get(uuid=uid)
    variant_list.status = VariantList.Status.PROCESSING
    variant_list.save()

    try:
        if variant_list.type == VariantList.Type.RECOMMENDED:
            process_new_recommended_variant_list(variant_list)

        if variant_list.type == VariantList.Type.CUSTOM:
            process_new_custom_variant_list(variant_list)

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
