import argparse

import hail as hl


def prepare_transcript_variant_lists(ds):
    ds = ds.select_globals()

    # Only include variants that passed QC filters in at least one of exome/genome samples.
    ds = ds.filter(
        (hl.is_defined(ds.filters.exome) & (hl.len(ds.filters.exome) == 0))
        | (hl.is_defined(ds.filters.genome) & (hl.len(ds.filters.genome) == 0))
    )

    ds = ds.filter(hl.len(ds.transcript_consequences) > 0)

    ds = ds.explode(ds.transcript_consequences, name="transcript_consequence")

    ds = ds.group_by(transcript_id=ds.transcript_consequence.transcript_id).aggregate(
        variants=hl.agg.collect(ds.row)
    )

    ds = ds.annotate(
        gene_id=ds.variants.first().transcript_consequence.gene_id,
        gene_symbol=ds.variants.first().transcript_consequence.gene_symbol,
    )
    ds = ds.annotate(
        variants=ds.variants.map(lambda variant: variant.select("locus", "alleles"))
    )

    return ds


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--partitions", default=2000, type=int)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    ds = prepare_transcript_variant_lists(hl.read_table(args.input))
    ds = ds.repartition(args.partitions, shuffle=True)
    ds.write(args.output, overwrite=True)


if __name__ == "__main__":
    main()
