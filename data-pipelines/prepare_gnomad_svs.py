import argparse
import os
import shutil
import subprocess
import tempfile

import hail as hl


TOP_LEVEL_INFO_FIELDS = [
    "ALGORITHMS",
    "BOTHSIDES_SUPPORT",
    "CPX_INTERVALS",
    "CPX_TYPE",
    "EVIDENCE",
    "PESR_GT_OVERDISPERSION",
    "SOURCE",
    "UNRESOLVED_TYPE",
    "PAR",
]

RANKED_CONSEQUENCES = [
    "LOF",
    "INTRAGENIC_EXON_DUP",
    "PARTIAL_EXON_DUP",
    "COPY_GAIN",
    "TSS_DUP",
    "MSV_EXON_OVERLAP",
    "DUP_PARTIAL",
    "PARTIAL_DISPERSED_DUP",
    "BREAKEND_EXONIC",
    "UTR",
    "PROMOTER",
    "INTRONIC",
    "INV_SPAN",
    "INTERGENIC",
    "NEAREST_TSS",
]


def x_position(chrom, position):
    contig_number = (
        hl.case()
        .when(chrom == "X", 23)
        .when(chrom == "Y", 24)
        .when(chrom[0] == "M", 25)
        .default(hl.int(chrom))
    )
    return hl.int64(contig_number) * 1_000_000_000 + position


def import_sv_vcf(vcf_path):
    mt = hl.import_vcf(vcf_path, force_bgz=True, reference_genome="GRCh38")
    print(mt.rows().count())
    # mt = mt.filter_rows( [
    #     hl.interval(
    #         hl.locus("chr1", 55039447, "GRCh38"),
    #         hl.locus("chr1", 55064852, "GRCh38"),
    #         includes_start=True,
    #         includes_end=True,
    #     )
    # ])
    mt.write("./data/sv.mt", overwrite=True)


def subset_mt(mt, intervals):
    pass


def write_to_ht(ht):
    pass


def import_svs_from_vcfs(vcf_path):
    ds = hl.import_vcf(vcf_path, force_bgz=True, reference_genome="GRCh38")

    ds = hl.read_table("./data/sv.ht")

    print(ds.describe())
    print(ds.show(5))
    # return

    ds = ds.rows()
    ds = ds.annotate(
        **{field.lower(): ds.info[field] for field in TOP_LEVEL_INFO_FIELDS}
    )

    ds = ds.annotate(
        variant_id=ds.rsid.replace("^gnomAD-SV_v3_", ""),
        reference_genome="GRCh38",
        # Start
        chrom=ds.locus.contig.replace("chr", ""),
        pos=ds.locus.position,
        # End
        end=ds.info.END,
        # Start 2
        chrom2=ds.info.CHR2.replace("chr", ""),
        pos2=ds.info.POS2,
        # End 2
        end2=ds.info.END2,
        # Other
        length=ds.info.SVLEN,
        type=ds.info.SVTYPE,
        alts=ds.alleles[1:],
    )

    ds = ds.annotate(
        xpos=x_position(ds.chrom, ds.pos),
        xend=x_position(ds.chrom, ds.end),
        xpos2=x_position(ds.chrom2, ds.pos2),
        xend2=x_position(ds.chrom2, ds.end2),
    )

    # MULTIALLELIC should not be used as a quality filter in the browser
    ds = ds.annotate(filters=ds.filters.difference(hl.set(["MULTIALLELIC"])))

    # Group gene lists for all consequences in one field
    ds = ds.annotate(
        consequences=hl.array(
            [
                hl.struct(
                    consequence=csq.lower(),
                    genes=hl.or_else(
                        ds.info[f"PREDICTED_{csq}"], hl.empty_array(hl.tstr)
                    ),
                )
                for csq in RANKED_CONSEQUENCES
                if csq not in ("INTERGENIC", "NEAREST_TSS")
            ]
        ).filter(lambda csq: hl.len(csq.genes) > 0)
    )
    ds = ds.annotate(intergenic=ds.info.PREDICTED_INTERGENIC)

    ds = ds.annotate(
        major_consequence=hl.rbind(
            ds.consequences.find(lambda csq: hl.len(csq.genes) > 0),
            lambda csq: hl.or_else(
                csq.consequence, hl.or_missing(ds.intergenic, "intergenic")
            ),
        )
    )

    return ds


vcf_path = "gs://gnomad-browser-data-pipeline/phil-scratch/gnomAD_SV_v3.release_4_1.sites_only.vcf.gz"
mt = import_sv_vcf(vcf_path)

intervals = []
subsetted_ht = subset_mt(mt, intervals)

write_to_ht(subsetted_ht)
