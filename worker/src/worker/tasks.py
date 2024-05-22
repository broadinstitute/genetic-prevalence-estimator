import json
import logging
import os
import sys
import traceback
import uuid

import hail as hl
import requests
from django.conf import settings

from calculator.models import VariantList, DashboardList
from calculator.serializers import VariantListSerializer, DashboardListSerializer


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


def combined_freq(ds, n_populations, gnomad_version, include_filtered=False):
    zeroes = hl.range(1 + n_populations).map(lambda _: 0)

    datasets_to_use = ("joint",) if gnomad_version == "4.1.0" else ("exome", "genome")

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
                        ds.freq[sample_set].get(field, zeroes),
                        zeroes,
                    )
                    for sample_set in datasets_to_use
                )
            ).map(lambda f: f[0] + f[1])
            for field in ("AC", "AN", "homozygote_count")
        }
    )


def annotate_variants_with_flags(
    ds, max_af_of_clinvar_path_or_likely_path_variants, max_an
):
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
            hl.or_missing(
                (ds.AC[0] / ds.AN[0] > max_af_of_clinvar_path_or_likely_path_variants)
                & (hl.is_missing(ds.clinvar_variation_id)),
                "high_AF",
            ),
            hl.or_missing((ds.AN[0]) < (max_an / 2), "low_AN"),
            hl.or_missing(ds.homozygote_count[0] > 0, "has_homozygotes"),
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
    gnomad_version = "4.1.0" if gnomad_version == "4.0.0" else gnomad_version

    assert gnomad_version in (
        "2.1.1",
        "3.1.2",
        "4.1.0",
    ), f"Invalid gnomAD version '{gnomad_version}'"

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

    if gnomad_version == "4.1.0":
        ds = ds.annotate(**ds.freq.joint)
    else:
        ds = ds.annotate(
            **combined_freq(
                ds=ds, gnomad_version=gnomad_version, n_populations=len(populations)
            )
        )

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
        )
    )

    max_af_of_clinvar_path_or_likely_path_variants = ds.aggregate(
        hl.agg.filter(
            ds.clinical_significance_category == "pathogenic_or_likely_pathogenic",
            hl.agg.max(ds.AC[0] / ds.AN[0]),
        )
    )

    max_an = ds.aggregate(hl.agg.max(ds.AN[0]))

    # if there are no clinvar path or likely path variants, the aggregation returns None
    # explicitly check for this None and substitute 1.1 to ensure nothing can get this flag
    max_af_of_clinvar_path_or_likely_path_variants = (
        max_af_of_clinvar_path_or_likely_path_variants
        if max_af_of_clinvar_path_or_likely_path_variants is not None
        else hl.int(1.1)
    )

    ds = ds.annotate(
        flags=annotate_variants_with_flags(
            ds,
            max_af_of_clinvar_path_or_likely_path_variants,
            max_an,
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

    if gnomad_version == "4.1.0" and variant_list.structural_variants:
        structural_variants = get_structural_variants(
            variant_list.structural_variants, metadata, gnomad_version
        )
        structural_variants = [
            json.loads(structural_variant)
            for structural_variant in hl.json(structural_variants.row_value).collect()
        ]
        variant_list.structural_variants = structural_variants
        variant_list.save()


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
    logger.info("Processing new variant list %s", uid)

    variant_list = VariantList.objects.get(uuid=uid)
    variant_list.status = VariantList.Status.PROCESSING
    # if variant_list.metadata["gnomad_version"] == "4.0.0":
    #     variant_list.metadata["gnomad_version"] = "4.1.0"
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


def get_highest_frequency_variants(ds, num_to_keep):
    ds = ds.filter(ds.AN[0] == 0, keep=False)
    ds = ds.order_by(hl.desc(ds.AC[0] / ds.AN[0]))
    ds = ds.head(num_to_keep)

    return ds


def _process_dashboard_list(dashboard_list):
    metadata = dashboard_list.metadata

    gnomad_version = metadata["gnomad_version"]
    assert gnomad_version in ("4.0.0",), f"Invalid gnomAD version '{gnomad_version}'"

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

        dashboard_list.metadata["gene_symbol"] = transcript["gene"]["symbol"]

    metadata["reference_genome"] = "GRCh38"
    reference_genome = metadata["reference_genome"]

    # get recommended variants
    ds = get_recommended_variants(metadata, transcript)

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
    dashboard_list.metadata["populations"] = populations

    ds = ds.annotate(**combined_freq(ds, n_populations=len(populations)))

    clinvar = hl.read_table(
        f"{settings.CLINVAR_DATA_PATH}/ClinVar_{reference_genome}_variants.ht"
    )
    dashboard_list.metadata["clinvar_version"] = hl.eval(clinvar.globals.release_date)

    ds = ds.annotate(
        **clinvar[ds.locus, ds.alleles].select(
            "clinvar_variation_id",
            "clinical_significance",
            "clinical_significance_category",
            "gold_stars",
        )
    )

    max_af_of_clinvar_path_or_likely_path_variants = ds.aggregate(
        hl.agg.filter(
            ds.clinical_significance_category == "pathogenic_or_likely_pathogenic",
            hl.agg.max(ds.AC[0] / ds.AN[0]),
        )
    )
    # if there are no clinvar path or likely path variants, the aggregation returns None
    # explicitly check for this None and substitute 1.1 to ensure nothing can get this flag
    max_af_of_clinvar_path_or_likely_path_variants = (
        max_af_of_clinvar_path_or_likely_path_variants
        if max_af_of_clinvar_path_or_likely_path_variants is not None
        else hl.int(1.1)
    )

    ds = ds.annotate(
        flags=annotate_variants_with_flags(
            ds, max_af_of_clinvar_path_or_likely_path_variants
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
    dashboard_list.variants = variants

    top_10_variants = get_highest_frequency_variants(ds, 10)
    top_10_variants = [
        json.loads(variant) for variant in hl.json(top_10_variants.row_value).collect()
    ]
    dashboard_list.top_ten_variants = top_10_variants

    dashboard_list.save()


def process_dashboard_list(uid):
    logger.info("Processing new dashboard list %s", uid)

    dashboard_list = DashboardList.objects.get(uuid=uid)
    dashboard_list.status = DashboardList.Status.PROCESSING
    dashboard_list.save()

    try:
        _process_dashboard_list(dashboard_list)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "Error processing new dashboard list",
            extra={"json_fields": {"dashboard_list": str(uid)}},
        )

        dashboard_list.refresh_from_db()
        dashboard_list.status = DashboardList.Status.ERROR
        dashboard_list.error = traceback.format_exc()
        dashboard_list.save()

    else:
        logger.info("Done processing new dashboard list %s", uid)

        dashboard_list.status = DashboardList.Status.READY
        dashboard_list.save()


def handle_event(event):
    try:
        event_type = event["type"]
        args = event["args"]

        if event_type == "process_variant_list":
            process_variant_list(uuid.UUID(hex=args["uuid"]))
        elif event_type == "process_dashboard_list":
            process_dashboard_list(uuid.UUID(hex=args["uuid"]))

    except KeyError:
        logger.error("Invalid event %s", event)
