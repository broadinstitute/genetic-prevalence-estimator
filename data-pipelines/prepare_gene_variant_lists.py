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


def prepare_gene_variant_lists(ds):
    ds = ds.select_globals()
    ds = ds.drop("freq")

    # Filter to only pLoF variants
    ds = ds.annotate(
        transcript_consequences=ds.transcript_consequences.filter(
            lambda csq: PLOF_VEP_CONSEQUENCE_TERMS.contains(csq.major_consequence)
        )
    )
    ds = ds.filter(hl.len(ds.transcript_consequences) > 0)

    ds = ds.annotate(gene_ids=hl.set(ds.transcript_consequences.gene_id))
    ds = ds.explode(ds.gene_ids, name="gene_id")
    ds = ds.annotate(
        transcript_consequences=ds.transcript_consequences.filter(
            lambda csq: csq.gene_id == ds.gene_id
        )
    )
    ds = ds.group_by("gene_id").aggregate(
        variants=hl.agg.collect(ds.row.drop("gene_id"))
    )
    return ds


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--partitions", default=2000, type=int)
    args = parser.parse_args()

    hl.init()

    ds = prepare_gene_variant_lists(hl.read_table(args.input))
    ds = ds.repartition(args.partitions, shuffle=True)
    ds.write(args.output, overwrite=True)


if __name__ == "__main__":
    main()
