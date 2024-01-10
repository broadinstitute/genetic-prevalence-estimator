import json
import logging
import os
import sys
import traceback
import uuid

import hail as hl
import requests
from django.conf import settings

from calculator.models import VariantList
from calculator.serializers import VariantListSerializer


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
    "gene_id",
    "gene_symbol",
    "transcript_id",
    # Frequency
    "AC",
    "AN",
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


def initialize_hail():
    spark_conf = os.getenv("SPARK_CONF", default=None)
    if spark_conf:
        spark_conf = json.loads(spark_conf)

    hl.init(
        idempotent=True,
        master="local[1]",
        log=settings.HAIL_LOG_PATH,
        quiet=not settings.DEBUG,
        spark_conf=spark_conf,
    )


def is_hail_working():
    try:
        hl.eval(hl.literal(1) + hl.literal(1))
        return True
    except Exception:  # pylint: disable=broad-except
        return False


def exit_if_hail_has_failed(sender, **kwargs):  # pylint: disable=unused-argument
    if not is_hail_working():
        sys.exit(1)


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
                symbol
            }
            chrom
            start
            stop
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


def get_recommended_variants(metadata, transcript):
    gnomad_version = metadata["gnomad_version"]
    reference_genome = metadata["reference_genome"]

    subset = "_non_ukb" if gnomad_version == "4.0.0_non-ukb" else ""
    gnomad_version = "4.0.0" if gnomad_version == "4.0.0_non-ukb" else gnomad_version

    ds = hl.read_table(
        f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_variants.ht"
    )

    assert ds.locus.dtype.reference_genome.name == reference_genome

    contig = transcript["chrom"]
    if reference_genome == "GRCh38":
        contig = f"chr{contig}"

    ds = hl.filter_intervals(
        ds,
        [
            hl.interval(
                hl.locus(contig, transcript["start"], reference_genome),
                hl.locus(contig, transcript["stop"], reference_genome),
                includes_start=True,
                includes_end=True,
            )
        ],
    )

    ds.transmute(
        freq=hl.struct(
            exome=ds.freq[f"exome{subset}"],
            genome=ds.freq[f"genome{subset}"],
        )
    )

    ds = ds.transmute(
        transcript_consequence=ds.transcript_consequences.find(
            lambda csq: csq.transcript_id == metadata["transcript_id"]
        )
    )
    ds = ds.filter(hl.is_defined(ds.transcript_consequence))
    ds = ds.transmute(**ds.transcript_consequence)

    # TODO: add a test for this
    if not metadata["include_gnomad_missense_with_high_revel_score"]:
        include_from_gnomad = PLOF_VEP_CONSEQUENCE_TERMS.contains(
            ds.major_consequence
        ) & (ds.lof == "HC")
    else:
        include_from_gnomad = (
            PLOF_VEP_CONSEQUENCE_TERMS.contains(ds.major_consequence) & (ds.lof == "HC")
        ) | ((ds.major_consequence == "missense_variant") & (ds.revel_score >= 9.32e-1))

    ds = ds.annotate(include_from_gnomad=include_from_gnomad)

    clinvar = hl.read_table(
        f"{settings.CLINVAR_DATA_PATH}/ClinVar_{reference_genome}_variants.ht"
    )

    if not metadata["include_clinvar_clinical_significance"]:
        ds = ds.annotate(include_from_clinvar=False)
    else:
        include_clinvar_clinical_significance = hl.set(
            metadata["include_clinvar_clinical_significance"]
        )

        include_from_clinvar = (
            include_clinvar_clinical_significance.contains(
                "pathogenic_or_likely_pathogenic"
            )
            & (
                clinvar[ds.locus, ds.alleles].clinical_significance_category
                == "pathogenic_or_likely_pathogenic"
            )
        ) | (
            include_clinvar_clinical_significance.contains(
                "conflicting_interpretations"
            )
            & (
                clinvar[ds.locus, ds.alleles].clinical_significance_category
                == "conflicting_interpretations"
            )
            & (
                clinvar[
                    ds.locus, ds.alleles
                ].conflicting_clinical_significance_categories.contains(
                    "pathogenic_or_likely_pathogenic"
                )
            )
        )

        ds = ds.annotate(include_from_clinvar=include_from_clinvar)

    ds = ds.filter(ds.include_from_gnomad | ds.include_from_clinvar)

    ds = ds.transmute(
        source=hl.array(
            [
                hl.or_missing(ds.include_from_gnomad, "gnomAD"),
                hl.or_missing(ds.include_from_clinvar, "ClinVar"),
            ]
        ).filter(hl.is_defined)
    )

    ds = ds.select("source")

    return ds


def _process_variant_list(variant_list):
    # Serialize variant list to normalize different versions of metadata
    serializer = VariantListSerializer(variant_list)
    metadata = serializer.data["metadata"]

    gnomad_version = metadata["gnomad_version"]
    assert gnomad_version in (
        "2.1.1",
        "3.1.2",
        "4.0.0",
        "4.0.0_non-ukb",
    ), f"Invalid gnomAD version '{gnomad_version}'"

    subset = "non_ukb" if gnomad_version == "4.0.0_non-ukb" else ""
    gnomad_version = "4.0.0" if gnomad_version == "4.0.0_non-ukb" else gnomad_version

    if metadata.get("include_gnomad_plof") or metadata.get(
        "include_clinvar_clinical_significance"
    ):
        assert metadata.get(
            "transcript_id"
        ), "Transcript ID is required to automatically include variants"

    if metadata.get("transcript_id"):
        transcript_id, transcript_version = metadata["transcript_id"].split(".")
        gene_id, gene_version = metadata["gene_id"].split(".")

        try:
            transcript = fetch_transcript(transcript_id, gnomad_version)
        except Exception as e:  # pylint: disable=broad-except
            raise Exception("Unable to validate transcript and gene") from e

        assert (
            transcript_version == transcript["transcript_version"]
        ), f"Requested transcript version ({transcript_version}) differs from version in gnomAD ({transcript['transcript_version']})"

        assert (
            gene_id == transcript["gene"]["gene_id"]
        ), f"Requested gene ({gene_id}) does not match the gene associated with transcript {transcript_id} in gnomAD ({transcript['gene']['gene_id']})"

        assert (
            gene_version == transcript["gene"]["gene_version"]
        ), f"Requested gene version ({gene_version}) differs from version in gnomAD ({transcript['gene']['gene_version']})"

        variant_list.metadata["gene_symbol"] = transcript["gene"]["symbol"]

    reference_genome = metadata["reference_genome"]

    # Import existing variants into a Hail Table
    ds = None
    if variant_list.variants:
        chrom_prefix = "" if gnomad_version == "2.1.1" else "chr"
        variant_ids = [
            f"{chrom_prefix}{variant['id']}" for variant in variant_list.variants
        ]
        ds = hl.Table.parallelize(
            [{"id": variant_id} for variant_id in variant_ids], hl.tstruct(id=hl.tstr)
        )
        ds = ds.annotate(**parse_variant_id(ds.id, reference_genome))
        ds = ds.key_by("locus", "alleles")
        ds = ds.select(source=["Custom"])

    # Add recommended variants
    if metadata.get("include_gnomad_plof") or metadata.get(
        "include_clinvar_clinical_significance"
    ):
        recommended_variants = get_recommended_variants(metadata, transcript)
        if ds:
            ds = ds.join(recommended_variants, how="outer")
        else:
            ds = recommended_variants

    # Annotate variants
    ds = ds.annotate(id=variant_id(ds.locus, ds.alleles))

    gnomad = hl.read_table(
        f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_variants.ht"
    )
    ds = ds.annotate(**gnomad[ds.locus, ds.alleles])

    if metadata.get("transcript_id"):
        ds = ds.transmute(
            transcript_consequence=ds.transcript_consequences.find(
                lambda csq: csq.transcript_id == metadata["transcript_id"]
            )
        )
    else:
        ds = ds.transmute(transcript_consequence=ds.transcript_consequences.first())

    ds = ds.transmute(**ds.transcript_consequence)

    populations = hl.eval(gnomad.globals.populations)
    variant_list.metadata["populations"] = populations

    ds = ds.annotate(**combined_freq(ds, n_populations=len(populations)))
    ds = ds.annotate(flags=flags(ds))

    clinvar = hl.read_table(
        f"{settings.CLINVAR_DATA_PATH}/ClinVar_{reference_genome}_variants.ht"
    )
    variant_list.metadata["clinvar_version"] = hl.eval(clinvar.globals.release_date)

    ds = ds.annotate(
        **clinvar[ds.locus, ds.alleles].select(
            "clinvar_variation_id", "clinical_significance", "gold_stars"
        )
    )

    if metadata.get("gene_id") and gnomad_version == "2.1.1":
        gene_id, gene_version = metadata["gene_id"].split(".")

        lof_curation_results = hl.read_table(
            f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_lof_curation_results.ht"
        )

        ds = ds.annotate(
            lof_curation=lof_curation_results[
                ds.locus, ds.alleles, hl.str(gene_id)
            ].select("verdict", "flags", "project")
        )

    table_fields = set(ds.row)
    select_fields = [field for field in VARIANT_FIELDS if field in table_fields]
    ds = ds.select(*select_fields)

    variants = [json.loads(variant) for variant in hl.json(ds.row_value).collect()]
    variant_list.variants = variants
    variant_list.save()


def process_variant_list(uid):
    logger.info("Processing new variant list %s", uid)

    variant_list = VariantList.objects.get(uuid=uid)
    variant_list.status = VariantList.Status.PROCESSING
    variant_list.save()

    try:
        _process_variant_list(variant_list)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "Error processing new variant list",
            extra={"json_fields": {"variant_list": str(uid)}},
        )

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

        if event_type == "process_variant_list":
            process_variant_list(uuid.UUID(hex=args["uuid"]))

    except KeyError:
        logger.error("Invalid event %s", event)
