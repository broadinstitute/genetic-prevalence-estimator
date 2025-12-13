import json
import logging
import os
import sys
import time
import traceback
import uuid
import signal

import hail as hl
import requests
from django.conf import settings

import requests


from calculator.models import VariantList, DashboardList
from calculator.serializers import (
    VariantListSerializer,
    DashboardListSerializer,
    is_variant_id,
    is_structural_variant_id,
)

IS_SHUTTING_DOWN = False
EXIT_SEQUENCE_STARTED = False

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

STRUCTURAL_VARIANT_FIELDS = [
    "id_upper_case",
    "id",
    # Consequence
    "major_consequence",
    "consequence",
    # Frequency
    "AC",
    "AN",
    "homozygote_count",
    # Other
    "chrom",
    "pos",
    "end",
    "chrom2",
    "pos2",
    "end2",
    "length",
    "type",
    #
    "flags",
]


def initialize_hail():
    logger.info(
        "Worker starting. Waiting 30 seconds before starting Hail to allow cleanup from previous worker"
    )
    sys.stdout.flush()

    logger.info("30s wait complete")
    sys.stdout.flush()
    sys.stderr.flush()

    spark_conf = os.getenv("SPARK_CONF", default=None)
    if spark_conf:
        spark_conf = json.loads(spark_conf)

    try:
        hl.init(
            idempotent=True,
            master="local[1]",
            log=settings.HAIL_LOG_PATH,
            quiet=not settings.DEBUG,
            spark_conf=spark_conf,
        )
    except Exception:
        os.kill(os.getppid(), signal.SIGTERM)


def is_hail_working():
    try:
        hl.eval(hl.literal(1) + hl.literal(1))
        return True
    except Exception:  # pylint: disable=broad-except
        return False


def exit_after_job_finished(sender, **kwargs):  # pylint: disable=unused-argument
    global IS_SHUTTING_DOWN
    global EXIT_SEQUENCE_STARTED

    if EXIT_SEQUENCE_STARTED:
        return

    EXIT_SEQUENCE_STARTED = True
    IS_SHUTTING_DOWN = True

    logger.info(
        "Job finished. Recycling container to clear Java Heap for next request via a new container."
    )
    sys.stdout.flush()
    sys.stderr.flush()

    # let 20x code get sent from worker, let hl.stop() free resources
    #   from host machine, and let kernel clear ports
    time.sleep(1)

    # Kill the gunicorn process to force getting a fresh container
    #   for the next request.
    try:
        logger.info("Gunicorn recycling now. Goodbye world.")
        os.kill(os.getppid(), signal.SIGTERM)
    except Exception as e:
        logger.info(f"Failed to recycle Gunicorn: {e}")
        logger.info("Recycling process as a fallback")
        os._exit(0)


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


def combined_freq(ds, n_populations, gnomad_version, include_filtered=False):
    zeroes = hl.range(1 + n_populations).map(lambda _: 0)

    if gnomad_version == "4.1.0":
        sample_set = "joint"
        return hl.struct(
            **{
                field: hl.if_else(
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
                    ds.freq[sample_set].get(field, zeroes),
                    zeroes,
                )
                for field in ("AC", "AN", "homozygote_count")
            },
        )
    else:
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
                                            ds.filters[sample_set],
                                            hl.empty_set(hl.tstr),
                                        )
                                    )
                                    == 0
                                )
                            ),
                            ds.freq[sample_set].get(field, zeroes),
                            zeroes,
                        )
                        for sample_set in ("exome", "genome")
                    )
                ).map(lambda f: f[0] + f[1])
                for field in ("AC", "AN", "homozygote_count")
            },
        )


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
        "reference_genome": (
            "GRCh37" if gnomad_version.split(".")[0] == "2" else "GRCh38"
        ),
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
    gnomad_version = "4.1.0" if gnomad_version == "4.0.0" else gnomad_version

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

    if gnomad_version == "4.1.0":
        ds.transmute(
            freq=hl.struct(
                exome=ds.freq[f"exome{subset}"],
                genome=ds.freq[f"genome{subset}"],
                joint=ds.freq["joint"],
            )
        )
    else:
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
    if (
        "include_gnomad_missense_with_high_revel_score" in metadata.keys()
        and metadata["include_gnomad_missense_with_high_revel_score"]
    ):
        include_from_gnomad = (
            PLOF_VEP_CONSEQUENCE_TERMS.contains(ds.major_consequence) & (ds.lof == "HC")
        ) | ((ds.major_consequence == "missense_variant") & (ds.revel_score >= 9.32e-1))
    else:
        include_from_gnomad = PLOF_VEP_CONSEQUENCE_TERMS.contains(
            ds.major_consequence
        ) & (ds.lof == "HC")

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

    # filter out any variant included from gnomAD that has a B/LB classification from ClinVar
    ds = ds.annotate(
        has_benign_or_likely_benign_classification_in_clinvar=hl.if_else(
            hl.is_defined(clinvar[ds.locus, ds.alleles])
            & (
                clinvar[ds.locus, ds.alleles].clinical_significance_category
                == "benign_or_likely_benign"
            ),
            True,
            False,
        )
    )
    ds = ds.filter(ds.has_benign_or_likely_benign_classification_in_clinvar, keep=False)

    ds = ds.transmute(
        source=hl.array(
            [hl.if_else(hl.is_defined(ds.include_from_clinvar), "ClinVar", "gnomAD")]
        ).filter(hl.is_defined)
    )

    ds = ds.select("source")

    return ds


def _import_existing_variants(variant_list, gnomad_version, reference_genome):
    logger.info(
        "  Importing existing variants at: %s", time.strftime("%Y-%m-%d %H:%M:%S")
    )
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
    return ds


def _annotate_variants_with_gnomAD(ds, variant_list, gnomad_version, metadata):
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

    ds = ds.annotate(
        **combined_freq(
            ds=ds, gnomad_version=gnomad_version, n_populations=len(populations)
        ),
    )

    return ds


def _annotate_variants_with_ClinVar(ds, variant_list, reference_genome):
    clinvar = hl.read_table(
        f"{settings.CLINVAR_DATA_PATH}/ClinVar_{reference_genome}_variants.ht"
    )

    variant_list.metadata["clinvar_version"] = hl.eval(clinvar.globals.release_date)

    ds = ds.annotate(
        **clinvar[ds.locus, ds.alleles].select(
            "clinvar_variation_id",
            "clinical_significance",
            "clinical_significance_category",
            "gold_stars",
        ),
    )

    return ds


def _annotate_variants_with_LoF_curation(ds, metadata, gnomad_version):
    gene_id, gene_version = metadata["gene_id"].split(".")

    lof_curation_results = hl.read_table(
        f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_lof_curation_results.ht"
    )

    ds = ds.annotate(
        lof_curation=lof_curation_results[ds.locus, ds.alleles, hl.str(gene_id)].select(
            "verdict", "flags", "project"
        )
    )

    return ds


def _annotate_variants_with_flags(ds):
    # Pre-compute aggregation values in a single pass
    agg_stats = ds.aggregate(
        hl.struct(
            max_an=hl.agg.max(ds.AN[0]),
            max_path_af=hl.agg.filter(
                ds.clinical_significance_category == "pathogenic_or_likely_pathogenic",
                hl.agg.max(ds.AC[0] / ds.AN[0]),
            ),
        )
    )

    # Handle edge case where no pathogenic variants exist
    max_af = hl.float(
        agg_stats.max_path_af if agg_stats.max_path_af is not None else 1.1
    )
    max_an = agg_stats.max_an if agg_stats.max_an is not None else 0

    # Calculate all flags in a single annotation step
    return ds.annotate(
        flags=hl.array(
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
                hl.or_missing(
                    (ds.AC[0] / ds.AN[0] > max_af)
                    & hl.is_missing(ds.clinvar_variation_id),
                    "high_AF",
                ),
                hl.or_missing(ds.AN[0] < (max_an / 2), "low_AN"),
                hl.or_missing(ds.homozygote_count[0] > 0, "has_homozygotes"),
            ]
        ).filter(hl.is_defined)
    )


def _process_variant_list(variant_list):
    start_time = time.time()

    # Serialize variant list to normalize different versions of metadata
    serializer = VariantListSerializer(variant_list)
    metadata = serializer.data["metadata"]

    gnomad_version = metadata["gnomad_version"]
    gnomad_version = "4.1.0" if gnomad_version == "4.0.0" else gnomad_version

    assert gnomad_version in (
        "2.1.1",
        "3.1.2",
        "4.1.0",
    ), f"Invalid gnomAD version '{gnomad_version}'"

    logger.info(
        "  Starting metadata serialization list at: %s",
        time.strftime("%Y-%m-%d %H:%M:%S"),
    )
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

    ds = None

    if variant_list.variants:
        ds = _import_existing_variants(variant_list, gnomad_version, reference_genome)

    # Add recommended variants
    if metadata.get("include_gnomad_plof") or metadata.get(
        "include_clinvar_clinical_significance"
    ):
        logger.info(
            "  Adding recommended variants at: %s",
            time.strftime("%Y-%m-%d %H:%M:%S"),
        )
        recommended_variants = get_recommended_variants(metadata, transcript)
        if ds:
            ds = ds.join(recommended_variants, how="outer")
        else:
            ds = recommended_variants

    ds = ds.annotate(id=variant_id(ds.locus, ds.alleles))

    logger.info("  Annotating with gnomAD at: %s", time.strftime("%Y-%m-%d %H:%M:%S"))
    ds = _annotate_variants_with_gnomAD(ds, variant_list, gnomad_version, metadata)

    logger.info("  Annotating with ClinVar at: %s", time.strftime("%Y-%m-%d %H:%M:%S"))
    ds = _annotate_variants_with_ClinVar(ds, variant_list, reference_genome)

    ds = ds.transmute(
        source=hl.array(
            [hl.if_else(hl.is_defined(ds.gold_stars), "ClinVar", "gnomAD")]
        ).filter(hl.is_defined)
    )

    logger.info(
        "  Handing off to annotate with flags helper at: %s",
        time.strftime("%Y-%m-%d %H:%M:%S"),
    )

    ds = _annotate_variants_with_flags(ds)
    ds = ds.filter(~ds.flags.contains("filtered"))

    if metadata.get("gene_id") and gnomad_version == "2.1.1":
        logger.info(
            "  Annotating with LoF Curation results at: %s",
            time.strftime("%Y-%m-%d %H:%M:%S"),
        )
        ds = _annotate_variants_with_LoF_curation(ds, metadata, gnomad_version)

    logger.info(
        "  Trimming HT to final shape at: %s", time.strftime("%Y-%m-%d %H:%M:%S")
    )
    table_fields = set(ds.row)
    select_fields = [field for field in VARIANT_FIELDS if field in table_fields]
    ds = ds.select(*select_fields)

    logger.info(
        "  Turning HT to json and loading into DB at: %s",
        time.strftime("%Y-%m-%d %H:%M:%S"),
    )
    variants = [json.loads(variant) for variant in hl.json(ds.row_value).collect()]
    variant_list.variants = variants
    variant_list.save()
    logger.info(
        "  Finished loading short variants at: %s", time.strftime("%Y-%m-%d %H:%M:%S")
    )

    if gnomad_version in ("2.1.1", "4.1.0") and variant_list.structural_variants:
        logger.info("  Adding SVs at: %s", time.strftime("%Y-%m-%d %H:%M:%S"))
        structural_variants = get_structural_variants(
            variant_list.structural_variants, metadata, gnomad_version
        )
        structural_variants = [
            json.loads(structural_variant)
            for structural_variant in hl.json(structural_variants.row_value).collect()
        ]
        variant_list.structural_variants = structural_variants
        variant_list.save()
        logger.info("  Finished loading SVs at: %s", time.strftime("%Y-%m-%d %H:%M:%S"))


def annotate_structural_variants_with_flags(ds):
    return hl.array(
        [
            hl.or_missing(ds.homozygote_count[0] > 0, "has_homozygotes"),
        ]
    ).filter(hl.is_defined)


def get_structural_variants(structural_variants, metadata, gnomad_version):
    gnomad_structural_variants = hl.read_table(
        f"{settings.GNOMAD_DATA_PATH}/gnomAD_v{gnomad_version}_structural_variants.ht"
    )

    structural_variant_ids = [
        structural_variant["id"] for structural_variant in structural_variants
    ]

    ds = hl.Table.parallelize(
        [
            {
                "id_upper_case": structural_variant_id.upper(),
            }
            for structural_variant_id in structural_variant_ids
        ],
        hl.tstruct(id_upper_case=hl.tstr),
    )

    ds = ds.annotate(**gnomad_structural_variants[ds.id_upper_case])

    ds = ds.annotate(**ds.freq.joint)

    if metadata.get("gene_symbol"):
        ds = ds.transmute(
            consequences=ds.consequences.find(
                lambda consequence: consequence.gene == metadata["gene_symbol"]
            )
        )
    else:
        ds = ds.transmute(consequences=ds.consequences.first())

    ds = ds.transmute(
        consequence=hl.or_missing(
            hl.is_defined(ds.consequences), ds.consequences.consequence
        )
    )

    ds = ds.annotate(flags=annotate_structural_variants_with_flags(ds))

    table_fields = set(ds.row)
    select_fields = [
        field for field in STRUCTURAL_VARIANT_FIELDS if field in table_fields
    ]
    ds = ds.select(*select_fields)
    return ds


def process_variant_list(uid):
    global IS_SHUTTING_DOWN

    if IS_SHUTTING_DOWN:
        logger.info("Worker is about to recycle - refuse job")
        raise RuntimeError("Worker is about to recycle - retry on another")

    start_time = time.time()
    logger.info(
        "Processing new variant list %s at: %s", uid, time.strftime("%Y-%m-%d %H:%M:%S")
    )

    variant_list = VariantList.objects.get(uuid=uid)
    variant_list.status = VariantList.Status.PROCESSING
    variant_list.save()

    try:
        _process_variant_list(variant_list)

    except (ConnectionRefusedError, requests.exceptions.ConnectionError):
        logger.warning(
            f"Worker got ConnectionRefused. Raise error to recycle this worker {uid}."
        )
        IS_SHUTTING_DOWN = True
        raise RuntimeError("Connection refused, force this container to recycle")

    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "Error processing new variant list",
            extra={"json_fields": {"variant_list": str(uid)}},
        )

        variant_list.refresh_from_db()
        variant_list.status = VariantList.Status.ERROR
        variant_list.error = traceback.format_exc()
        variant_list.save()
        IS_SHUTTING_DOWN = True

    else:
        end_time = time.time()
        duration = end_time - start_time
        logger.info(
            "Done processing variant list %s at: %s, took %.2f seconds",
            uid,
            time.strftime("%Y-%m-%d %H:%M:%S"),
            duration,
        )

        variant_list.status = VariantList.Status.READY

        variant_list.save()
        IS_SHUTTING_DOWN = True


def handle_event(event):
    try:
        event_type = event["type"]
        args = event["args"]

        if event_type == "process_variant_list":
            process_variant_list(uuid.UUID(hex=args["uuid"]))

    except KeyError:
        logger.error("Invalid event %s", event)
