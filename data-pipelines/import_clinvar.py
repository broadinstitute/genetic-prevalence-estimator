import argparse
import gzip
import os
import shutil
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


# https://www.ncbi.nlm.nih.gov/clinvar/docs/clinsig/
# These must be kept in sync with CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES
# in frontend/src/constants/clinvar.ts
CLINICAL_SIGNIFICANCE_CATEGORIES = hl.dict(
    {
        "pathogenic_or_likely_pathogenic": {
            "association",
            "Likely pathogenic",
            "Likely pathogenic/Likely risk allele",
            "Likely pathogenic/Pathogenic",
            "Pathogenic",
            "Pathogenic/Pathogenic",
            "Pathogenic/Likely pathogenic",
            "Pathogenic/Likely pathogenic/Likely risk allele",
            "Pathogenic/Likely pathogenic/Pathogenic",
            "risk factor",
        },
        "conflicting_interpretations": {
            "conflicting data from submitters",
            "Conflicting interpretations of pathogenicity",
        },
        "uncertain_significance": {
            "Uncertain significance",
            "Uncertain significance/Uncertain risk allele",
        },
        "benign_or_likely_benign": {"Benign", "Benign/Likely benign", "Likely benign"},
        "other": {
            "Affects",
            "association not found",
            "confers sensitivity",
            "drug response",
            "Established risk allele",
            "Likely risk allele",
            "low penetrance",
            "not provided",
            "other",
            "Pathogenic/Likely risk allele",
            "protective",
            "Uncertain risk allele",
        },
    }
)


CLINICAL_SIGNIFICANCE_CATEGORY = hl.dict(
    CLINICAL_SIGNIFICANCE_CATEGORIES.items().flatmap(
        lambda item: hl.array(item[1]).map(
            lambda clinical_significance: (clinical_significance, item[0])
        )
    )
)


CLINICAL_SIGNIFICANCE_CATEGORY_RANKING = hl.dict(
    {
        "pathogenic_or_likely_pathogenic": 0,
        "conflicting_interpretations": 1,
        "uncertain_significance": 2,
        "benign_or_likely_benign": 3,
        "other": 4,
    }
)


GOLD_STARS = hl.dict(
    {
        "no interpretation for the single variant": 0,
        "no assertion provided": 0,
        "no assertion criteria provided": 0,
        "criteria provided, single submitter": 1,
        "criteria provided, conflicting interpretations": 1,
        "criteria provided, multiple submitters, no conflicts": 2,
        "reviewed by expert panel": 3,
        "practice guideline": 4,
    }
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

    clinvar_vcf_url = "file://" + os.path.abspath(clinvar_vcf_path)
    if shutil.which("hdfs"):
        subprocess.check_call(
            [
                "hdfs",
                "dfs",
                "-cp",
                "-f",
                clinvar_vcf_url,
                "/tmp/" + os.path.basename(clinvar_vcf_path),
            ]
        )
        clinvar_vcf_url = "/tmp/" + os.path.basename(clinvar_vcf_path)

    ds = hl.import_vcf(
        clinvar_vcf_url,
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

    ds = ds.annotate(clinvar_variation_id=ds.rsid)

    ds = ds.annotate(
        clinical_significance=hl.set(
            # CLNSIG is an array, but most rows contain only one element with multiple pipe
            # delimited values. Flatmap and split should work both with the current format and
            # if the value is properly formatted as an array sometime in the future.
            ds.info.CLNSIG.flatmap(lambda s: s.split(r"\|")).map(
                lambda s: s.replace("^_", "").replace("_", " ")
            )
        ),
        conflicting_clinical_significances=hl.set(
            hl.or_else(ds.info.CLNSIGCONF, hl.empty_array(hl.tstr))
            # CLNSIGCONF is an array, but when defined, contains only one element with multiple
            # pipe delimited values. Flatmap and split should work both with the current format
            # and if the value is properly formatted as an array sometime in the future.
            .flatmap(lambda s: s.split(r"\|")).map(
                lambda s: s.replace("^_", "").replace("_", " ").replace(r"\(\d+\)$", "")
            )
        ),
        gold_stars=GOLD_STARS[
            hl.delimit(
                ds.info.CLNREVSTAT.map(lambda s: s.replace("^_", "").replace("_", " ")),
                ", ",
            )
        ],
    )

    # Categorize clinical significance.
    ds = ds.annotate(
        clinical_significance_categories=ds.clinical_significance.map(
            lambda c: CLINICAL_SIGNIFICANCE_CATEGORY[c]
        ),
        conflicting_clinical_significance_categories=ds.conflicting_clinical_significances.map(
            lambda c: CLINICAL_SIGNIFICANCE_CATEGORY[c]
        ),
    )

    ds = ds.transmute(
        clinical_significance_category=hl.sorted(
            ds.clinical_significance_categories,
            lambda category: CLINICAL_SIGNIFICANCE_CATEGORY_RANKING[category],
        ).first()
    )

    ds = ds.annotate(
        conflicting_clinical_significance_categories=hl.or_missing(
            ds.clinical_significance_category == "conflicting_interpretations",
            ds.conflicting_clinical_significance_categories,
        ),
    )

    # Convert sets to arrays so that they can be JSON formatted in worker tasks.
    ds = ds.annotate(
        clinical_significance=hl.array(ds.clinical_significance),
        conflicting_clinical_significance_categories=hl.array(
            ds.conflicting_clinical_significance_categories
        ),
    )

    # Store only selected fields.
    ds = ds.select(
        "clinvar_variation_id",
        "clinical_significance",
        "clinical_significance_category",
        "conflicting_clinical_significance_categories",
        "gold_stars",
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
