import argparse
import gzip
import os
import subprocess
import tempfile

import hail as hl


CLINVAR_FTP_PATH = "ftp://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_{reference_genome}/weekly/clinvar.vcf.gz"


def _get_vcf_meta_info(vcf_path, key):
    with gzip.open(vcf_path, "rt") as f:
        for line in f:
            if line.startswith(f"##{key}="):
                value = line.split("=")[-1].strip()
                return value

            if not line.startswith("#"):
                break

    raise Exception(f"{key} meta-information not found in VCF at '{vcf_path}'")


def download_clinvar_vcf(output_path, reference_genome):
    if reference_genome not in ("GRCh37", "GRCh38"):
        raise ValueError("Invalid reference_genome: " + str(reference_genome))

    subprocess.run(
        [
            "curl",
            "--silent",
            "--output",
            output_path,
            CLINVAR_FTP_PATH.format(reference_genome=reference_genome),
        ],
        check=True,
    )


CLINICAL_SIGNIFICANCE_CATEGORIES = hl.literal(
    [
        (
            "pathogenic_or_likely_pathogenic",
            {
                "association",
                "Likely_pathogenic",
                "Pathogenic",
                "Pathogenic/Likely_pathogenic",
                "risk_factor",
            },
        ),
        (
            "conflicting_interpretations",
            {
                "conflicting_data_from_submitters",
                "Conflicting_interpretations_of_pathogenicity",
            },
        ),
        (
            "uncertain_significance",
            {
                "Uncertain_significance",
            },
        ),
        (
            "benign_or_likely_benign",
            {"Benign", "Benign/Likely_benign", "Likely_benign"},
        ),
        (
            "other",
            {
                "Affects",
                "association_not_found",
                "confers_sensitivity",
                "drug_response",
                "not_provided",
                "other",
                "protective",
            },
        ),
    ]
)


def get_clinical_significance_category(clinical_significance):
    return (
        CLINICAL_SIGNIFICANCE_CATEGORIES.filter(
            lambda category: clinical_significance.intersection(category[1]).size() > 0
        )
        .map(lambda category: category[0])
        .first()
    )


def import_clinvar_vcf(clinvar_vcf_path, *, intervals=None, partitions=2000):
    clinvar_release_date = _get_vcf_meta_info(clinvar_vcf_path, "fileDate")
    reference_genome = _get_vcf_meta_info(clinvar_vcf_path, "reference")

    contig_recoding = None
    if reference_genome == "GRCh38":
        ref = hl.get_reference("GRCh38")
        contig_recoding = {
            ref_contig.replace("chr", ""): ref_contig
            for ref_contig in ref.contigs
            if "chr" in ref_contig
        }

    ds = hl.import_vcf(
        "file://" + os.path.abspath(clinvar_vcf_path),
        contig_recoding=contig_recoding,
        drop_samples=True,
        force=True,
        reference_genome=reference_genome,
        skip_invalid_loci=True,
    ).rows()

    if intervals:
        ds = hl.filter_intervals(ds, intervals)

    ds = ds.repartition(partitions, shuffle=True)

    ds = ds.annotate_globals(
        reference_genome=reference_genome,
        release_date=clinvar_release_date,
    )

    ds = ds.select(
        clinvar_variation_id=ds.rsid,
        clinical_significance=hl.set(ds.info.CLNSIG.map(lambda s: s.replace("^_", ""))),
    )

    all_clinical_significances = ds.aggregate(
        hl.agg.explode(hl.agg.collect_as_set, ds.clinical_significance)
    )
    uncategorized_clinical_significances = all_clinical_significances.difference(
        hl.eval(
            hl.set(
                CLINICAL_SIGNIFICANCE_CATEGORIES.flatmap(
                    lambda category: hl.array(category[1])
                )
            )
        )
    )

    assert (
        len(uncategorized_clinical_significances) == 0
    ), f"Uncategorized clinical significances: {', '.join(uncategorized_clinical_significances)}"

    ds = ds.annotate(
        clinical_significance=hl.array(
            ds.clinical_significance.map(
                lambda clinical_significance: clinical_significance.replace("_", " ")
            )
        ),
        clinical_significance_category=get_clinical_significance_category(
            ds.clinical_significance
        ),
    )

    return ds


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reference-genome", choices=("GRCh37", "GRCh38"), default="GRCh38"
    )
    parser.add_argument("--intervals")
    parser.add_argument("--partitions", default=2000, type=int)
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("output")
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    intervals = None
    if args.intervals:
        intervals = [
            hl.parse_locus_interval(interval, reference_genome=args.reference_genome)
            for interval in args.intervals.split(",")
        ]

    with tempfile.TemporaryDirectory() as tmp_dir:
        os.chdir(tmp_dir)
        clinvar_vcf_path = f"ClinVar_{args.reference_genome}.vcf.gz"
        download_clinvar_vcf(clinvar_vcf_path, args.reference_genome)
        ds = import_clinvar_vcf(
            clinvar_vcf_path, intervals=intervals, partitions=args.partitions
        )
        ds.write(args.output, overwrite=True)


if __name__ == "__main__":
    main()
