import argparse

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


PLOF_VEP_CONSEQUENCE_TERMS = hl.set(
    [
        "transcript_ablation",
        "splice_acceptor_variant",
        "splice_donor_variant",
        "stop_gained",
        "frameshift_variant",
    ]
)


def _get_gnomad_populations(ds):
    return hl.eval(
        hl.set(
            ds.freq_meta.filter(lambda meta: hl.is_missing(meta.get("downsampling")))
            .filter(lambda meta: hl.is_missing(meta.get("subset")))
            .map(lambda meta: meta.get("pop"))
        ).remove(hl.missing(hl.tstr))
    )


def get_gnomad_v2_variants():
    def freq(ds, subset=None, pop=None, sex=None, raw=False):
        if subset is None:
            subset = "gnomad"

        if sex == "XX":
            sex = "female"
        if sex == "XY":
            sex = "male"

        parts = [s for s in [subset, pop, sex] if s is not None]

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

    populations = _get_gnomad_populations(exomes).union(
        _get_gnomad_populations(genomes)
    )

    exomes = exomes.select(
        exome=hl.struct(
            overall=freq(exomes),
            populations=hl.struct(
                **{pop: freq(exomes, pop=pop) for pop in populations}
            ),
        ),
        transcript_consequences=exomes.vep.transcript_consequences,
    )

    genomes = genomes.select(
        genome=hl.struct(
            overall=freq(genomes),
            populations=hl.struct(
                **{pop: freq(genomes, pop=pop) for pop in populations}
            ),
        ),
        transcript_consequences=genomes.vep.transcript_consequences,
    )

    exomes = exomes.select_globals()
    genomes = genomes.select_globals()
    ds = exomes.join(genomes, how="outer")
    ds = ds.transmute(
        transcript_consequences=hl.or_else(
            ds.transcript_consequences, ds.transcript_consequences_1
        )
    )

    ds = ds.annotate_globals(populations=set(populations))

    return ds


def get_gnomad_v3_variants():
    def freq(ds, subset=None, pop=None, sex=None, raw=False):
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
        "gs://gcp-public-data--gnomad/release/3.1.1/ht/genomes/gnomad.genomes.v3.1.1.sites.ht"
    )

    populations = hl.eval(
        hl.set(
            ds.freq_meta.filter(lambda meta: hl.is_missing(meta.get("downsampling")))
            .filter(lambda meta: hl.is_missing(meta.get("subset")))
            .map(lambda meta: meta.get("pop"))
        ).remove(hl.missing(hl.tstr))
    )

    ds = ds.select(
        genomes=hl.struct(
            overall=freq(ds),
            populations=hl.struct(**{pop: freq(ds, pop=pop) for pop in populations}),
        ),
        transcript_consequences=ds.vep.transcript_consequences,
    )
    ds = ds.annotate(exome=hl.missing(ds.genome.dtype))

    ds = ds.select_globals(populations=set(populations))

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

    ds = ds.transmute(freq=hl.struct(exome=ds.exome, genome=ds.genome))

    ds = ds.annotate(
        transcript_consequences=ds.transcript_consequences.map(
            lambda csq: csq.annotate(
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

    # Filter to only pLoF variants
    ds = ds.annotate(
        transcript_consequences=ds.transcript_consequences.filter(
            lambda csq: PLOF_VEP_CONSEQUENCE_TERMS.contains(csq.major_consequence)
        )
    )
    ds = ds.filter(hl.len(ds.transcript_consequences) > 0)

    ds = ds.repartition(partitions, shuffle=True)

    return ds


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gnomad-version", choices=(2, 3), default=2, type=int)
    parser.add_argument("--intervals")
    parser.add_argument("--partitions", default=2000, type=int)
    parser.add_argument("output")
    args = parser.parse_args()

    hl.init()

    intervals = None
    if args.intervals:
        intervals = [
            hl.parse_locus_interval(interval) for interval in args.intervals.split(",")
        ]

    ds = prepare_gnomad_variants(
        args.gnomad_version, intervals=intervals, partitions=args.partitions
    )
    ds.write(args.output, overwrite=True)


if __name__ == "__main__":
    main()
