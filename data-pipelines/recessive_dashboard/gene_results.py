import os
from datetime import datetime

import hail as hl
import pandas as pd

from recessive_dashboard.orphanet import (
    annotate_gene_results_with_orphanet_prevalences,
)
from recessive_dashboard.outputs import write_recommended_variants_to_csv
from recessive_dashboard.variant_flags_and_frequencies import (
    calculate_carrier_frequency_and_prevalence,
    flag_and_filter_variants,
    select_top_ten_variants,
)
from recessive_dashboard.variant_selection import collect_gene_variants


def _format_duration_since(start_time):
    duration_seconds = (datetime.now() - start_time).total_seconds()
    minutes, seconds = divmod(int(duration_seconds), 60)
    return f"{minutes:02d}m{seconds:02d}s"


def _subset_tables_to_batch_region(
    ht_gnomad_variants, ht_clinvar_variants, chrom, start, stop
):
    print("    -- Subsetting Hail tables...")
    region_interval = hl.locus_interval(
        f"chr{chrom}",
        start,
        stop,
        includes_start=True,
        includes_end=True,
        reference_genome="GRCh38",
    )

    chrom_gnomad_variants = hl.filter_intervals(ht_gnomad_variants, [region_interval])
    chrom_clinvar_variants = hl.filter_intervals(ht_clinvar_variants, [region_interval])

    return (chrom_gnomad_variants, chrom_clinvar_variants)


def _single_chromosome_of_batch(df_genes_this_batch):
    batch_chrom_list = df_genes_this_batch["chrom"].values
    if len(set(batch_chrom_list)) > 1:
        print("!!=== Panic! Multiple chroms in this batch!")
        print("!!=== Exiting early")
        exit(1)

    return batch_chrom_list[0]


def _transcript_id_with_version(row):
    safe_mane_select_transcript_ensembl_version = (
        0
        if pd.isna(row.mane_select_transcript_ensemble_version)
        else row.mane_select_transcript_ensemble_version
    )

    if safe_mane_select_transcript_ensembl_version == 0:
        print(
            f"   - Row has {row.mane_select_transcript_ensemble_version} for transcript version! Using fallback of {safe_mane_select_transcript_ensembl_version}"
        )

    return (
        f"{row.preferred_transcript_id}.{safe_mane_select_transcript_ensembl_version}"
    )


def _dashboard_gene_result(
    row,
    base_dir,
    chrom_gnomad_variants,
    chrom_clinvar_variants,
    metadata_populations,
    metadata_clinvar_version,
):
    gene_id_with_version = f"{row.gene_id}.{row.gene_version}"
    transcript_id_with_version = _transcript_id_with_version(row)

    notes = f"This list was algorithmically generated for the gene {row.symbol}, with the transcript {row.preferred_transcript_id}"
    date_created = datetime.now().isoformat()

    metadata = {
        "gnomad_version": "4.1.1",
        "reference_genome": "GRCh38",
        "gene_symbol": row.symbol,
        "populations": metadata_populations,
        "clinvar_version": metadata_clinvar_version,
        "gene_id": gene_id_with_version,
        "transcript_id": transcript_id_with_version,
        "include_gnomad_plof": True,
        "include_clinvar_clinical_significance": ["pathogenic_or_likely_pathogenic"],
        "include_gnomad_missense_with_high_revel_score": False,
    }

    collected_variants = collect_gene_variants(
        transcript_id=transcript_id_with_version,
        start=row.start,
        stop=row.stop,
        chrom=row.chrom,
        gnomad_variants=chrom_gnomad_variants,
        clinvar_variants=chrom_clinvar_variants,
    )

    recommended_variants = flag_and_filter_variants(collected_variants)
    top_ten_variants = select_top_ten_variants(recommended_variants)

    write_recommended_variants_to_csv(
        base_dir, row.symbol, row.gene_id, recommended_variants
    )

    calculations = calculate_carrier_frequency_and_prevalence(
        recommended_variants, metadata_populations
    )

    return {
        "gene_id": row.gene_id,
        "label": f"{row.symbol} - Dashboard",
        "notes": notes,
        "date_created": date_created,
        "metadata": metadata,
        "variant_calculations": calculations,
        "top_ten_variants": top_ten_variants,
        "genetic_prevalence_genereviews": "",
        "genetic_prevalence_other": "",
        "genetic_incidence_other": "",
        "type": row.type,
    }


def prepare_dashboard_gene_results(
    df_genes_this_batch,
    base_dir,
    gnomad_variants_path,
):
    ht_gnomad_variants = hl.read_table(gnomad_variants_path)
    metadata_populations = hl.eval(ht_gnomad_variants.globals.populations)

    clinvar_variants_path = os.path.join(
        base_dir, "processed_data", "ClinVar", "ClinVar_GRCh38_variants.ht"
    )
    ht_clinvar_variants = hl.read_table(clinvar_variants_path)
    metadata_clinvar_version = hl.eval(ht_clinvar_variants.globals.release_date)

    orphanet_prevalences_path = os.path.join(
        base_dir, "processed_data", "orphanet_prevalences.tsv"
    )
    df_orphanet_prevalences = pd.read_csv(orphanet_prevalences_path, sep="\t")

    batch_chrom = _single_chromosome_of_batch(df_genes_this_batch)
    batch_pos_min = df_genes_this_batch["start"].values.min()
    batch_pos_max = df_genes_this_batch["stop"].values.max()

    subset_start_time = datetime.now()

    (
        chrom_gnomad_variants,
        chrom_clinvar_variants,
    ) = _subset_tables_to_batch_region(
        ht_gnomad_variants,
        ht_clinvar_variants,
        batch_chrom,
        batch_pos_min,
        batch_pos_max,
    )
    chrom_gnomad_variants = chrom_gnomad_variants.persist()
    chrom_clinvar_variants = chrom_clinvar_variants.persist()

    print(f"    - Finished in {_format_duration_since(subset_start_time)}")

    gene_results = []
    for batch_i, (index, row) in enumerate(df_genes_this_batch.iterrows(), start=1):
        single_gene_start_time = datetime.now()
        print(
            f"  -- Processing row {index + 1} [{row.symbol}, chr{row.chrom} - {row.gene_id}] ({batch_i} of {len(df_genes_this_batch)} in batch) ({row.type})"
        )

        gene_results.append(
            _dashboard_gene_result(
                row,
                base_dir,
                chrom_gnomad_variants,
                chrom_clinvar_variants,
                metadata_populations,
                metadata_clinvar_version,
            )
        )

        print(f"    - Finished in {_format_duration_since(single_gene_start_time)}")

    gene_results_frame = pd.DataFrame(gene_results)
    gene_results_frame = annotate_gene_results_with_orphanet_prevalences(
        gene_results_frame, df_orphanet_prevalences
    )

    chrom_gnomad_variants.unpersist()
    chrom_clinvar_variants.unpersist()

    return gene_results_frame
