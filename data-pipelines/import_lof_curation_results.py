import argparse
import csv
import re

import hail as hl


FLAG_MAPPING = {
    "Essential Splice Rescue": "Splice Rescue",
    "Genotyping Error": "Genotyping Issue",
    "Low Relative Mean Pext": "Low Relative Mean Pext/Pext Does Not Support Splicing",
    "Low Relative Mean Pext/Pext does not Support Splicing": "Low Relative Mean Pext/Pext Does Not Support Splicing",
    "Mapping Error": "Mapping Issue",
    "Mnp": "MNV/Frame Restoring Indel",
    "Mnv/Frame Restore": "MNV/Frame Restoring Indel",
    "MNV": "MNV/Frame Restoring Indel",
    "Uninformative pext": "Uninformative Pext",
    "Weak Essential Splice Rescue": "Weak/Unrecognized Splice Rescue",
}

VERDICT_MAPPING = {
    "conflicting_evidence": "Uncertain",
    "insufficient_evidence": "Uncertain",
    "uncertain": "Uncertain",
    "likely_lof": "Likely LoF",
    "likely_not_lof": "Likely not LoF",
    "lof": "LoF",
    "not_lof": "Not LoF",
}

# If a result for a variant/gene pair is present in more than one file, the result in the first file in this list takes precedence.
GNOMAD_V2_LOF_CURATION_RESULTS = [
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/NSD1_curation_results.csv",
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/gnomAD_addendum_curation_results.csv",
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/metabolic_conditions_genes_curation_results.csv",
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/haploinsufficient_genes_curation_results.csv",
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/AP4_curation_results.csv",
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/FIG4_curation_results.csv",
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/lysosomal_storage_disease_genes_curation_results.csv",
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/MCOLN1_curation_results.csv",
    "gs://gcp-public-data--gnomad/truth-sets/source/lof-curation/all_homozygous_curation_results.csv",
]


def import_gnomad_v2_lof_curation_results():
    all_flags = set()

    with hl.hadoop_open("/tmp/import_temp.tsv", "w") as temp_output_file:
        writer = csv.writer(temp_output_file, delimiter="\t", quotechar='"')
        writer.writerow(
            [
                "chrom",
                "position",
                "ref",
                "alt",
                "genes",
                "verdict",
                "flags",
                "project",
                "project_index",
            ]
        )

        for project_index, path in enumerate(GNOMAD_V2_LOF_CURATION_RESULTS):
            with hl.hadoop_open(path, "r") as input_file:
                reader = csv.DictReader(input_file)

                project = re.sub(r"(_curation_results)?\.csv$", "", path.split("/")[-1])

                raw_dataset_flags = [
                    f[5:] for f in reader.fieldnames if f.startswith("Flag ")
                ]

                dataset_flags = [FLAG_MAPPING.get(f, f) for f in raw_dataset_flags]

                all_flags = all_flags.union(set(dataset_flags))

                for row in reader:
                    [chrom, pos, ref, alt] = row["Variant ID"].split("-")

                    variant_flags = [
                        FLAG_MAPPING.get(f, f)
                        for f in raw_dataset_flags
                        if row[f"Flag {f}"] == "TRUE"
                    ]

                    genes = [
                        gene_id
                        for (gene_id, gene_symbol) in (
                            gene.split(":") for gene in row["Gene"].split(";")
                        )
                    ]

                    verdict = row["Verdict"]

                    if verdict == "inufficient_evidence":
                        verdict = "insufficient_evidence"

                    verdict = VERDICT_MAPPING[verdict]

                    output_row = [
                        chrom,
                        pos,
                        ref,
                        alt,
                        ",".join(genes),
                        verdict,
                        ",".join(variant_flags),
                        project,
                        project_index,
                    ]

                    writer.writerow(output_row)

    ds = hl.import_table("/tmp/import_temp.tsv")

    ds = ds.transmute(
        locus=hl.locus(ds.chrom, hl.int(ds.position)),
        alleles=[ds.ref, ds.alt],
    )

    ds = ds.annotate(
        genes=ds.genes.split(","),
        flags=hl.set(
            hl.if_else(ds.flags == "", hl.empty_array(hl.tstr), ds.flags.split(","))
        ),
    )

    ds = ds.explode(ds.genes, name="gene_id")

    ds = ds.group_by(ds.locus, ds.alleles, ds.gene_id).aggregate(
        result=hl.agg.take(
            ds.row.drop("locus", "alleles", "gene_id"), 1, ds.project_index
        )
    )

    ds = ds.annotate(**ds.result[0]).drop("result", "project_index")

    for flag in sorted(list(all_flags)):
        print(flag)

    return ds


def import_gnomad_lof_curation_results(version, *, intervals=None, partitions=16):
    if version == 2:
        ds = import_gnomad_v2_lof_curation_results()
    elif version == 3:
        raise NotImplementedError("LoF curation results are no available for gnomAD v3")
    else:
        raise ValueError(f"Invalid gnomAD version: '{version}'")

    if intervals:
        ds = hl.filter_intervals(ds, intervals)

    ds = ds.repartition(partitions, shuffle=True)

    return ds


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gnomad-version", choices=(2,), default=2, type=int)
    parser.add_argument("--intervals")
    parser.add_argument("--partitions", default=16, type=int)
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("output")
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    intervals = None
    if args.intervals:
        reference_genome = "GRCh37" if args.gnomad_version == 2 else "GRCh38"
        intervals = [
            hl.parse_locus_interval(interval, reference_genome=reference_genome)
            for interval in args.intervals.split(",")
        ]

    ds = import_gnomad_lof_curation_results(
        args.gnomad_version, intervals=intervals, partitions=args.partitions
    )
    ds.write(args.output, overwrite=True)


if __name__ == "__main__":
    main()
