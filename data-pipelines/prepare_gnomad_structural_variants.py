import argparse

import hail as hl


# TODO: copy this bucket into GeniE's bucket, or give the genie worker
#   service account read access to gnomAD's data buckets


GNOMAD_V2_STRUCTURAL_VARIANTS_PATH = (
    "/Users/rgrant/Documents/pseudo-desktop/v2-svs/gnomad_sv_v2/structural_variants.ht"
)

# piggyback off gnomAD's browser SV hailtable to avoid having to re-parse and shape
#   the raw VCFs
GNOMAD_V4_STRUCTURAL_VARIANTS_PATH = (
    "/Users/rgrant/Documents/pseudo-desktop/SVs-copy/structural_variants_step_3.ht"
)


def get_gnomad_v2_structural_variants():

    GNOMAD_V2_SV_ANCESTRIES = [
        "afr",
        "amr",
        "asj",  # not in v2 SVs, will be added as 0/0
        "eas",
        "eas/kor",  # not in v2 SVs, will be added as 0/0
        "eas/oea",  # not in v2 SVs, will be added as 0/0
        "fin",  # not in v2 SVs, will be added as 0/0
        "eur",  # v2 SVs has "eur" instead of fin/nfe, here we remap eur -> "nfe"
        "nfe/bgr",  # not in v2 SVs, will be added as 0/0
        "nfe/est",  # not in v2 SVs, will be added as 0/0
        "nfe/nwe",  # not in v2 SVs, will be added as 0/0
        "nfe/onf",  # not in v2 SVs, will be added as 0/0
        "nfe/seu",  # not in v2 SVs, will be added as 0/0
        "nfe/swe",  # not in v2 SVs, will be added as 0/0
        "oth",
        "sas",  # not in v2 SVs, will be added as 0/0
    ]

    def freq(ds, pop):
        return hl.rbind(
            ds.freq.all.populations.find(lambda freq: freq.id == pop),
            lambda found_pop: hl.if_else(
                hl.is_missing(found_pop),
                hl.struct(
                    # manually set "eur" to "nfe" to keep their frequencies
                    id=hl.if_else(pop != "eur", pop, "nfe"),
                    AC=0,
                    AN=0,
                    homozygote_count=0,
                ),
                hl.struct(
                    # manually set "eur" to "nfe" to keep their frequencies
                    id=hl.if_else(found_pop.id != "eur", found_pop.id, "nfe"),
                    AC=found_pop.ac,
                    AN=found_pop.an,
                    homozygote_count=found_pop.homozygote_count,
                ),
            ),
        )

    ds = hl.read_table(GNOMAD_V2_STRUCTURAL_VARIANTS_PATH)

    ds = ds.select(
        id_upper_case=ds.variant_id.upper(),
        # type == 'class' of structural variant
        type=ds.type,
        major_consequence=ds.major_consequence,
        consequences=hl.flatmap(
            lambda consequence: hl.map(
                lambda gene: hl.struct(consequence=consequence.consequence, gene=gene),
                consequence.genes,
            ),
            ds.consequences,
        ),
        # HGVSc
        chrom=ds.chrom,
        pos=ds.pos,
        end=ds.end,
        chrom2=ds.chrom,
        pos2=ds.pos,
        end2=ds.end,
        # HGVSp
        length=ds.length,
        # reshape freq struct
        freq=hl.struct(
            joint=hl.struct(
                AC=[
                    hl.or_else(ds.freq.all.ac, 0),
                    *(freq(ds, pop=pop).AC for pop in GNOMAD_V2_SV_ANCESTRIES),
                ],
                AN=[
                    hl.or_else(ds.freq.all.an, 0),
                    *(freq(ds, pop=pop).AN for pop in GNOMAD_V2_SV_ANCESTRIES),
                ],
                homozygote_count=[
                    hl.or_else(ds.freq.all.homozygote_count, 0),
                    *(
                        freq(ds, pop=pop).homozygote_count
                        for pop in GNOMAD_V2_SV_ANCESTRIES
                    ),
                ],
            )
        ),
    )

    ds = ds.key_by("id_upper_case")
    ds = ds.transmute(id=ds.variant_id)

    return ds


def get_gnomad_v4_structural_variants():

    GNOMAD_V4_SV_ANCESTRIES = [
        "afr",
        "amr",
        "asj",
        "eas",
        "fin",
        "mid",
        "nfe",
        "rmi",
        "sas",
    ]

    def freq(ds, pop):
        return hl.rbind(
            ds.freq.all.populations.filter(lambda freq: freq.id == pop)[0],
            lambda f: hl.struct(
                AC=f.ac,
                AN=f.an,
                homozygote_count=f.homozygote_count,
            ),
        )

    ds = hl.read_table(GNOMAD_V4_STRUCTURAL_VARIANTS_PATH)

    ds = ds.select(
        id_upper_case=ds.variant_id_upper_case,
        # really class, used in "consequence" as well as HGVSc
        type=ds.type,
        major_consequence=ds.major_consequence,
        consequences=hl.flatmap(
            lambda consequence: hl.map(
                lambda gene: hl.struct(consequence=consequence.consequence, gene=gene),
                consequence.genes,
            ),
            ds.consequences,
        ),
        # HGVSc
        chrom=ds.chrom,
        pos=ds.pos,
        end=ds.end,
        chrom2=ds.chrom2,
        pos2=ds.pos2,
        end2=ds.end2,
        # HGVSp
        length=ds.length,
        # reshape freq struct
        freq=hl.struct(
            joint=hl.struct(
                AC=[
                    hl.or_else(ds.freq.all.ac, 0),
                    *(freq(ds, pop=pop).AC for pop in GNOMAD_V4_SV_ANCESTRIES),
                ],
                AN=[
                    hl.or_else(ds.freq.all.an, 0),
                    *(freq(ds, pop=pop).AN for pop in GNOMAD_V4_SV_ANCESTRIES),
                ],
                homozygote_count=[
                    hl.or_else(ds.freq.all.homozygote_count, 0),
                    *(
                        freq(ds, pop=pop).homozygote_count
                        for pop in GNOMAD_V4_SV_ANCESTRIES
                    ),
                ],
            ),
        ),
    )

    ds = ds.key_by("id_upper_case")
    ds = ds.transmute(id=ds.variant_id)

    return ds


def get_gnomad_structural_variants(gnomad_sv_version):
    if gnomad_sv_version == 4:
        return get_gnomad_v4_structural_variants()

    if gnomad_sv_version == 2:
        return get_gnomad_v2_structural_variants()

    raise ValueError(f"Invalid gnomAD version: '{gnomad_sv_version}")


def prepare_gnomad_structural_variants(gnomad_sv_version):
    ds = get_gnomad_structural_variants(gnomad_sv_version)
    return ds


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gnomad-sv-version", choices=(2, 4), default=4, type=int)
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("output")
    args = parser.parse_args()

    hl.init(quiet=args.quiet)

    ds = prepare_gnomad_structural_variants(args.gnomad_sv_version)

    ds.write(args.output, overwrite=True)


if __name__ == "__main__":
    main()
