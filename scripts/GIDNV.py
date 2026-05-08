import hail as hl
hl.init()

constraint=hl.read_table('gs://gcp-public-data--gnomad/release/4.1.1/constraint/gnomad.v4.1.1.constraint_metrics.ht/')

#from omim website
omim = hl.import_table(
    'gs://rungar-sandbox-storage/genemap2.txt',
    comment='#',
    no_header=True
).rename({
    'f0': 'Chromosome',
    'f1': 'Genomic Position Start',
    'f2': 'Genomic Position End',
    'f3': 'Cyto Location',
    'f4': 'Computed Cyto Location',
    'f5': 'MIM Number',
    'f6': 'Gene/Locus And Other Related Symbols',
    'f7': 'Gene Name',
    'f8': 'Approved Gene Symbol',
    'f9': 'Entrez Gene ID',
    'f10': 'Ensembl Gene ID',
    'f11': 'Comments',
    'f12': 'Phenotypes',
    'f13': 'Mouse Gene Symbol/ID'
})

#from https://www.genenames.org/data/genegroup/#!/group/141
olfactory_hgnc = hl.import_table(
    'gs://rungar-sandbox-storage/olfactory_genes.txt'
)

# Step 1: Filter OMIM to genes with symbols AND phenotypes
omim_filtered = omim.filter(
    (hl.len(omim['Approved Gene Symbol']) > 0) &
    (hl.len(omim['Phenotypes']) > 0)
)

omim_unique_genes = omim_filtered.aggregate(
    hl.agg.collect_as_set(omim_filtered['Approved Gene Symbol'])
)

print(f"Unique genes in OMIM (with phenotypes): {len(omim_unique_genes)}")

# Step 2: Get unique genes in constraint
constraint_unique_genes = filtered_constraint.aggregate(
    hl.agg.collect_as_set(filtered_constraint.gene)
)
print(f"Unique genes in constraint: {len(constraint_unique_genes)}")

# Step 3: Calculate overlaps
overlap = len(omim_unique_genes.intersection(constraint_unique_genes))
print(f"Genes in both OMIM and constraint: {overlap}")

omim_only = len(omim_unique_genes - constraint_unique_genes)
print(f"Genes in OMIM but not in constraint: {omim_only}")

constraint_only = len(constraint_unique_genes - omim_unique_genes)
print(f"Genes in constraint but not in OMIM: {constraint_only}")

# Step 4: Get olfactory genes from HGNC
olfactory_genes = olfactory_hgnc.aggregate(
    hl.agg.collect_as_set(olfactory_hgnc['Approved symbol'])
)
print(f"\nNumber of olfactory genes from HGNC: {len(olfactory_genes)}")

# Step 5: Remove OMIM genes from constraint
constraint_no_omim = constraint_unique_genes - omim_unique_genes
filtered_constraint_no_omim = filtered_constraint.filter(
    hl.literal(constraint_no_omim).contains(filtered_constraint.gene)
)

# Step 6: Remove olfactory genes
constraint_no_omim_no_olfactory = constraint_no_omim - olfactory_genes
filtered_constraint_final = filtered_constraint_no_omim.filter(
    hl.literal(constraint_no_omim_no_olfactory).contains(filtered_constraint_no_omim.gene)
)

# Step 7: Final counts
print(f"\nGenes after removing OMIM: {len(constraint_no_omim)}")
print(f"Olfactory genes removed: {len(constraint_no_omim & olfactory_genes)}")
print(f"Final genes (no OMIM, no olfactory): {len(constraint_no_omim_no_olfactory)}")

final_count = filtered_constraint_final.count()
print(f"Final table row count: {final_count}")

constraint_not_in_omim_olfactory = constraint_unique_genes - omim_unique_genes - olfactory_genes

print(f"Genes in constraint but not in OMIM: {len(constraint_not_in_omim_olfactory)}")

# Filter constraint table to only these genes
filtered_constraint_no_omim_olfactory = filtered_constraint.filter(
    hl.literal(constraint_not_in_omim_olfactory).contains(filtered_constraint.gene)
)

# Calculate average LOF OE
lof_oe_mean = filtered_constraint_no_omim_olfactory.aggregate(
    hl.agg.mean(filtered_constraint_no_omim_olfactory.selected.lof.oe)
)

# Calculate average missense OE
mis_oe_mean = filtered_constraint_no_omim_olfactory.aggregate(
    hl.agg.mean(filtered_constraint_no_omim_olfactory.selected.mis.oe)
)

print(f"LOF OE mean: {lof_oe_mean:.4f}")
print(f"Missense OE mean: {mis_oe_mean:.4f}")

protein_coding = constraint.filter(constraint.transcript_type == 'protein_coding')


#either MANE select OR canonical if not mane_select. annotate if use canonical or mane_select.
filtered_constraint = protein_coding.annotate(
    priority = hl.case()
        .when(protein_coding.mane_select, 1)
        .when(protein_coding.canonical, 2)
        .default(3),
    transcript_selection = hl.case()
        .when(protein_coding.mane_select, 'mane_select')
        .when(protein_coding.canonical, 'canonical')
        .default('other')
)

# Step 2: Group and take the row with minimum priority
filtered_constraint = (filtered_constraint
    .group_by('gene', 'gene_id')
    .aggregate(
        selected = hl.agg.take(
            filtered_constraint.row, 
            1, 
            ordering=filtered_constraint.priority
        )[0]
    )
)


# Count transcript_selection types
transcript_selection_counts = filtered_constraint.aggregate(
    hl.agg.counter(filtered_constraint.selected.transcript_selection)
)

print("Transcript selection breakdown:")
for selection_type, count in sorted(transcript_selection_counts.items()):
    print(f"  {selection_type}: {count}")

# Total
total = sum(transcript_selection_counts.values())
print(f"\nTotal: {total}")

OE_PRIOR_LOF = 0.675
OE_PRIOR_MIS = 0.906

# Step 1: Extract fields
gi_constraint = filtered_constraint.annotate(
    lof_oe = filtered_constraint.selected.lof.oe,
    lof_mu = filtered_constraint.selected.lof.mu,
    mis_oe = filtered_constraint.selected.mis.oe,
    mis_mu = filtered_constraint.selected.mis.mu,
)

# Step 2: Calculate components and GI in the same annotate
# Set negative values to 0
gi_constraint = gi_constraint.annotate(
    mis_component = hl.max(0, (OE_PRIOR_MIS - gi_constraint.mis_oe) * gi_constraint.mis_mu * 2), 
    lof_component = hl.max(0, (OE_PRIOR_LOF - gi_constraint.lof_oe) * gi_constraint.lof_mu * 2),
)

# Step 3: Calculate GI and birth prevalence
gi_constraint = gi_constraint.annotate(
    GI_gene = gi_constraint.mis_component + gi_constraint.lof_component,
)

gi_constraint = gi_constraint.annotate(
    birth_prev_per_100k = gi_constraint.GI_gene * 100000
)

# Export to TSV file
gi_constraint.key_by().select(
    'gene',
    'lof_oe',
    'lof_mu',
    'mis_oe',
    'mis_mu',
    'lof_component',
    'mis_component',
    'GI_gene',
    'birth_prev_per_100k'
).export('gs://rungar-sandbox-storage/gi_constraint_results.tsv')

print("Export complete!")

