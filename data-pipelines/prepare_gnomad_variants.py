import argparse
import os
import shutil
import subprocess
import tempfile

import hail as hl


VEP_CONSEQUENCE_TERMS = [
    "transcript_ablation",
    "splice_acceptor_variant",
    "splice_donor_variant",
    "stop_gained",
    "frameshift_variant",
    "stop_lost",
    "start_lost",  # new in v81
    "initiator_codon_variant",  # deprecated
    "transcript_amplification",
    "inframe_insertion",
    "inframe_deletion",
    "missense_variant",
    "protein_altering_variant",  # new in v79
    "splice_region_variant",
    "incomplete_terminal_codon_variant",
    "start_retained_variant",
    "stop_retained_variant",
    "synonymous_variant",
    "coding_sequence_variant",
    "mature_miRNA_variant",
    "5_prime_UTR_variant",
    "3_prime_UTR_variant",
    "non_coding_transcript_exon_variant",
    "non_coding_exon_variant",  # deprecated
    "intron_variant",
    "NMD_transcript_variant",
    "non_coding_transcript_variant",
    "nc_transcript_variant",  # deprecated
    "upstream_gene_variant",
    "downstream_gene_variant",
    "TFBS_ablation",
    "TFBS_amplification",
    "TF_binding_site_variant",
    "regulatory_region_ablation",
    "regulatory_region_amplification",
    "feature_elongation",
    "regulatory_region_variant",
    "feature_truncation",
    "intergenic_variant",
]

# Maps each consequence term to its rank in the list
VEP_CONSEQUENCE_TERM_RANK = hl.dict(
    {term: rank for rank, term in enumerate(VEP_CONSEQUENCE_TERMS)}
)


GENCODE_GTF_URL = "ftp://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_{version}/gencode.v{version}.annotation.gtf.gz"


def download_gencode_gtf(version, output_path):
    subprocess.run(
        [
            "curl",
            "--silent",
            "--output",
            output_path,
            GENCODE_GTF_URL.format(version=version),
        ],
        check=True,
    )


def get_gene_and_transcript_versions(gtf_path, reference_genome):
    if reference_genome not in ("GRCh37", "GRCh38"):
        raise ValueError("Invalid reference_genome: " + str(reference_genome))

    gtf_url = "file://" + os.path.abspath(gtf_path)
    if shutil.which("hdfs"):
        subprocess.check_call(
            [
                "hdfs",
                "dfs",
                "-cp",
                "-f",
                gtf_url,
                "/tmp/" + os.path.basename(gtf_path),
            ]
        )
        gtf_url = "/tmp/" + os.path.basename(gtf_path)

    ds = hl.experimental.import_gtf(
        gtf_url, force=True, reference_genome=reference_genome
    )

    ds = ds.key_by()
    ds = ds.filter(ds.feature == "transcript")
    ds = ds.select("transcript_id", "gene_id")

    return hl.dict([(row.transcript_id.split(".")[0], row) for row in ds.collect()])


def _get_gnomad_population_sample_counts(ds):
    return hl.eval(
        hl.dict(
            hl.zip(
                ds.globals.freq_meta,
                ds.globals.freq_sample_count
                if "freq_sample_count" in ds.globals
                else hl.empty_array(hl.tint),
                fill_missing=True,
            )
            .filter(
                lambda meta_and_sample_count: hl.all(
                    hl.is_missing(meta_and_sample_count[0].get("downsampling")),
                    hl.is_missing(meta_and_sample_count[0].get("subset")),
                    hl.is_defined(meta_and_sample_count[0].get("pop")),
                )
            )
            .starmap(
                lambda meta, sample_count: (
                    (meta.get("pop"), meta.get("subpop")),
                    sample_count,
                )
            )
        )
    )


def _sort_populations(populations):
    return sorted(populations, key=lambda p: (p[0], p[1] or ""))


def _format_populations(populations):
    return ["/".join(filter(None, p)) for p in populations]


GNOMAD_V2_EXOME_SAMPLE_COUNTS = {
    ("afr", None): 8128,
    ("amr", None): 17296,
    ("asj", None): 5040,
    ("eas", None): 9197,
    ("eas", "jpn"): 76,
    ("eas", "kor"): 1909,
    ("eas", "oea"): 7212,
    ("fin", None): 10824,
    ("nfe", None): 56885,
    ("nfe", "bgr"): 1335,
    ("nfe", "est"): 121,
    ("nfe", "nwe"): 21111,
    ("nfe", "onf"): 15499,
    ("nfe", "seu"): 5752,
    ("nfe", "swe"): 13067,
    ("oth", None): 3070,
    ("sas", None): 15308,
}

GNOMAD_V2_GENOME_SAMPLE_COUNTS = {
    ("afr", None): 4359,
    ("amr", None): 422,
    ("asj", None): 145,
    ("eas", None): 780,
    ("fin", None): 1738,
    ("nfe", None): 7718,
    ("nfe", "est"): 2297,
    ("nfe", "nwe"): 4299,
    ("nfe", "onf"): 1069,
    ("nfe", "seu"): 53,
    ("oth", None): 544,
}


def get_gnomad_v2_variants():
    def freq(
        ds, subset=None, pop=None, subpop=None, sex=None, raw=False
    ):  # pylint: disable=too-many-arguments
        if subpop and sex:
            raise ValueError("Only one of subpop or sex can be specified")

        if subset is None:
            subset = "gnomad"

        if sex == "XX":
            sex = "female"
        if sex == "XY":
            sex = "male"

        parts = [s for s in [subset, pop, subpop, sex] if s is not None]

        if raw:
            parts.append("raw")

        key = "_".join(parts)

        return hl.rbind(
            hl.or_missing(
                ds.freq_index_dict.contains(key), ds.freq[ds.freq_index_dict[key]]
            ),
            lambda f: hl.struct(
                AC=hl.or_else(f.AC, 0),
                AN=hl.or_else(f.AN, 0),
            ),
        )

    exomes = hl.read_table(
        "gs://gcp-public-data--gnomad/release/2.1.1/ht/exomes/gnomad.exomes.r2.1.1.sites.ht"
    )
    genomes = hl.read_table(
        "gs://gcp-public-data--gnomad/release/2.1.1/ht/genomes/gnomad.genomes.r2.1.1.sites.ht"
    )

    exome_population_sample_counts = {
        pop: GNOMAD_V2_EXOME_SAMPLE_COUNTS.get(pop, 0)
        for pop in _get_gnomad_population_sample_counts(exomes)
    }
    genome_population_sample_counts = {
        pop: GNOMAD_V2_GENOME_SAMPLE_COUNTS.get(pop, 0)
        for pop in _get_gnomad_population_sample_counts(genomes)
    }

    all_populations = set(exome_population_sample_counts) | set(
        genome_population_sample_counts
    )

    populations = _sort_populations(
        pop
        for pop in all_populations
        if exome_population_sample_counts.get(pop, 0)
        + genome_population_sample_counts.get(pop, 0)
        > 1000
    )

    exomes = exomes.select(
        exome_freq=hl.struct(
            AC=[
                freq(exomes).AC,
                *(
                    freq(exomes, pop=pop, subpop=subpop).AC
                    for pop, subpop in populations
                ),
            ],
            AN=[
                freq(exomes).AN,
                *(
                    freq(exomes, pop=pop, subpop=subpop).AN
                    for pop, subpop in populations
                ),
            ],
        ),
        exome_filters=exomes.filters,
        transcript_consequences=exomes.vep.transcript_consequences,
    )
    exomes = exomes.filter(exomes.exome_freq.AC[0] > 0)

    genomes = genomes.select(
        genome_freq=hl.struct(
            AC=[
                freq(genomes).AC,
                *(
                    freq(genomes, pop=pop, subpop=subpop).AC
                    for pop, subpop in populations
                ),
            ],
            AN=[
                freq(genomes).AN,
                *(
                    freq(genomes, pop=pop, subpop=subpop).AN
                    for pop, subpop in populations
                ),
            ],
        ),
        genome_filters=genomes.filters,
        transcript_consequences=genomes.vep.transcript_consequences,
    )
    genomes = genomes.filter(genomes.genome_freq.AC[0] > 0)

    exomes = exomes.select_globals()
    genomes = genomes.select_globals()
    ds = exomes.join(genomes, how="outer")
    ds = ds.transmute(
        transcript_consequences=hl.or_else(
            ds.transcript_consequences, ds.transcript_consequences_1
        )
    )

    ds = ds.select_globals(populations=_format_populations(populations))

    return ds


def get_gnomad_v3_variants():
    def freq(
        ds, subset=None, pop=None, subpop=None, sex=None, raw=False
    ):  # pylint: disable=too-many-arguments
        if subpop:
            raise ValueError("subpops are not available for gnomAD v3")

        parts = [s for s in [subset, pop, sex] if s is not None]
        parts.append("raw" if raw else "adj")
        key = "-".join(parts)

        return hl.rbind(
            hl.or_missing(
                ds.freq_index_dict.contains(key), ds.freq[ds.freq_index_dict[key]]
            ),
            lambda f: hl.struct(
                AC=hl.or_else(f.AC, 0),
                AN=hl.or_else(f.AN, 0),
            ),
        )

    ds = hl.read_table(
        "gs://gcp-public-data--gnomad/release/3.1.2/ht/genomes/gnomad.genomes.v3.1.2.sites.ht"
    )

    population_sample_counts = _get_gnomad_population_sample_counts(ds)
    populations = _sort_populations(
        set(
            pop
            for pop, sample_count in population_sample_counts.items()
            if sample_count > 1000
        )
    )

    ds = ds.select(
        genome_freq=hl.struct(
            AC=[
                freq(ds).AC,
                *(freq(ds, pop=pop, subpop=subpop).AC for pop, subpop in populations),
            ],
            AN=[
                freq(ds).AN,
                *(freq(ds, pop=pop, subpop=subpop).AN for pop, subpop in populations),
            ],
        ),
        genome_filters=ds.filters,
        transcript_consequences=ds.vep.transcript_consequences,
    )
    ds = ds.filter(ds.genome_freq.AC[0] > 0)

    ds = ds.annotate(
        exome_freq=hl.missing(ds.genome_freq.dtype),
        exome_filters=hl.missing(ds.genome_filters.dtype),
    )

    ds = ds.select_globals(populations=_format_populations(populations))

    return ds


def get_gnomad_variants(version):
    if version == 3:
        return get_gnomad_v3_variants()

    if version == 2:
        return get_gnomad_v2_variants()

    raise ValueError(f"Invalid gnomAD version: '{version}'")


def prepare_gnomad_variants(gnomad_version, *, intervals=None, partitions=2000):
    ds = get_gnomad_variants(gnomad_version)

    if intervals:
        ds = hl.filter_intervals(ds, intervals)

    ds = ds.transmute(freq=hl.struct(exome=ds.exome_freq, genome=ds.genome_freq))

    ds = ds.annotate(
        sample_sets=hl.array(
            [
                hl.or_missing(hl.is_defined(ds.freq.exome), "exome"),
                hl.or_missing(hl.is_defined(ds.freq.genome), "genome"),
            ]
        ).filter(hl.is_defined)
    )

    ds = ds.transmute(
        filters=hl.struct(
            exome=hl.or_missing(
                hl.is_defined(ds.exome_filters) & (hl.len(ds.exome_filters) > 0),
                ds.exome_filters,
            ),
            genome=hl.or_missing(
                hl.is_defined(ds.genome_filters) & (hl.len(ds.genome_filters) > 0),
                ds.genome_filters,
            ),
        )
    )
    ds = ds.annotate(
        filters=hl.or_missing(
            hl.is_defined(ds.filters.exome) | hl.is_defined(ds.filters.genome),
            ds.filters,
        )
    )

    ds = ds.annotate(
        transcript_consequences=ds.transcript_consequences.map(
            lambda c: c.annotate(
                consequence_terms=c.consequence_terms.filter(
                    lambda t: ~hl.set(
                        ["upstream_gene_variant", "downstream_gene_variant"]
                    ).contains(t)
                )
            )
        ).filter(lambda c: c.consequence_terms.size() > 0)
    )

    ds = ds.annotate(
        transcript_consequences=ds.transcript_consequences.map(
            lambda csq: csq.annotate(
                hgvsc=csq.hgvsc.split(":")[-1],
                hgvsp=csq.hgvsp.split(":")[-1],
                lof=hl.if_else(csq.lof == "", hl.missing(hl.tstr), csq.lof),
                major_consequence=hl.sorted(
                    csq.consequence_terms,
                    lambda term: VEP_CONSEQUENCE_TERM_RANK[term],
                ).first(),
            )
        ).map(
            lambda csq: csq.annotate(
                consequence_rank=VEP_CONSEQUENCE_TERM_RANK[csq.major_consequence],
            )
        )
    )

    ds = ds.annotate(
        transcript_consequences=hl.sorted(
            ds.transcript_consequences,
            lambda csq: (
                hl.if_else(
                    csq.biotype == "protein_coding",
                    0,
                    1,
                    missing_false=True,
                ),
                csq.consequence_rank,
            ),
        )
    )

    ds = ds.annotate(
        transcript_consequences=ds.transcript_consequences.map(
            lambda csq: csq.select(
                "gene_id",
                "gene_symbol",
                "hgvsc",
                "hgvsp",
                "lof",
                "lof_filter",
                "lof_flags",
                "major_consequence",
                "transcript_id",
            )
        ),
    )

    ds = ds.repartition(partitions, shuffle=True)

    return ds


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gnomad-version", choices=(2, 3), default=2, type=int)
    parser.add_argument("--intervals")
    parser.add_argument("--partitions", default=2000, type=int)
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("output")
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    reference_genome = "GRCh37" if args.gnomad_version == 2 else "GRCh38"

    intervals = None
    if args.intervals:
        intervals = [
            hl.parse_locus_interval(interval, reference_genome=reference_genome)
            for interval in args.intervals.split(",")
        ]

    ds = prepare_gnomad_variants(
        args.gnomad_version, intervals=intervals, partitions=args.partitions
    )

    gencode_version = "19" if args.gnomad_version == 2 else "35"
    with tempfile.TemporaryDirectory() as tmp_dir:
        os.chdir(tmp_dir)
        gencode_gtf_path = f"gencode.v{gencode_version}.gtf.gz"
        download_gencode_gtf(gencode_version, gencode_gtf_path)
        transcripts = get_gene_and_transcript_versions(
            gencode_gtf_path, reference_genome=reference_genome
        )
        ds = ds.annotate(
            transcript_consequences=ds.transcript_consequences.map(
                lambda csq: csq.annotate(**transcripts.get(csq.transcript_id))
            )
        )

    ds.write(args.output, overwrite=True)


if __name__ == "__main__":
    main()
