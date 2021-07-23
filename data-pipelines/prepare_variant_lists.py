import argparse

import hail as hl


PLOF_VEP_CONSEQUENCE_TERMS = hl.set(
    [
        "transcript_ablation",
        "splice_acceptor_variant",
        "splice_donor_variant",
        "stop_gained",
        "frameshift_variant",
    ]
)


def prepare_variant_lists(ds):
    ds = ds.select_globals()
    ds = ds.drop("freq")

    ds = ds.filter(hl.len(ds.transcript_consequences) > 0)

    ds = ds.explode(ds.transcript_consequences, name="transcript_consequence")

    ds = ds.filter(
        PLOF_VEP_CONSEQUENCE_TERMS.contains(ds.transcript_consequence.major_consequence)
    )

    ds = ds.group_by(transcript_id=ds.transcript_consequence.transcript_id).aggregate(
        variants=hl.agg.collect(ds.row)
    )

    ds = ds.annotate(
        gene_id=ds.variants.first().transcript_consequence.gene_id,
        gene_symbol=ds.variants.first().transcript_consequence.gene_symbol,
    )
    ds = ds.annotate(
        variants=ds.variants.map(
            lambda variant: variant.annotate(
                transcript_consequence=variant.transcript_consequence.drop(
                    "gene_id", "gene_symbol", "transcript_id"
                )
            )
        )
    )

    return ds


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--partitions", default=2000, type=int)
    args = parser.parse_args()

    hl.init()

    ds = prepare_variant_lists(hl.read_table(args.input))
    ds = ds.repartition(args.partitions, shuffle=True)
    ds.write(args.output, overwrite=True)


if __name__ == "__main__":
    main()
