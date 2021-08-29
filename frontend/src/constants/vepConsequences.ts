export const RANKED_VEP_CONSEQUENCES = [
  {
    term: "transcript_ablation",
    label: "transcript ablation",
  },
  {
    term: "splice_acceptor_variant",
    label: "splice acceptor",
  },
  {
    term: "splice_donor_variant",
    label: "splice donor",
  },
  {
    term: "stop_gained",
    label: "stop gained",
  },
  {
    term: "frameshift_variant",
    label: "frameshift",
  },
  {
    term: "stop_lost",
    label: "stop lost",
  },
  {
    term: "start_lost",
    label: "start lost",
  },
  {
    term: "inframe_insertion",
    label: "inframe insertion",
  },
  {
    term: "inframe_deletion",
    label: "inframe deletion",
  },
  {
    term: "missense_variant",
    label: "missense",
  },
  {
    term: "protein_altering_variant",
    label: "protein altering",
  },
  {
    term: "incomplete_terminal_codon_variant",
    label: "incomplete terminal codon",
  },
  {
    term: "stop_retained_variant",
    label: "stop retained",
  },
  {
    term: "synonymous_variant",
    label: "synonymous",
  },
  {
    term: "coding_sequence_variant",
    label: "coding sequence",
  },
  {
    term: "mature_miRNA_variant",
    label: "mature miRNA",
  },
  {
    term: "5_prime_UTR_variant",
    label: "5' UTR",
  },
  {
    term: "3_prime_UTR_variant",
    label: "3' UTR",
  },
  {
    term: "non_coding_transcript_exon_variant",
    label: "non coding transcript exon",
  },
  {
    term: "non_coding_exon_variant",
    label: "non coding exon",
  },
  {
    term: "NMD_transcript_variant",
    label: "NMD transcript",
  },
  {
    term: "non_coding_transcript_variant",
    label: "non coding transcript",
  },
  {
    term: "nc_transcript_variant",
    label: "nc transcript",
  },
  {
    term: "downstream_gene_variant",
    label: "downstream gene",
  },
  {
    term: "TFBS_ablation",
    label: "TFBS ablation",
  },
  {
    term: "TFBS_amplification",
    label: "TFBS amplification",
  },
  {
    term: "TF_binding_site_variant",
    label: "TF binding site",
  },
  {
    term: "regulatory_region_ablation",
    label: "regulatory region ablation",
  },
  {
    term: "regulatory_region_amplification",
    label: "regulatory region amplification",
  },
  {
    term: "feature_elongation",
    label: "feature elongation",
  },
  {
    term: "regulatory_region_variant",
    label: "regulatory region",
  },
  {
    term: "feature_truncation",
    label: "feature truncation",
  },
  {
    term: "intergenic_variant",
    label: "intergenic variant",
  },
  {
    term: "intron_variant",
    label: "intron",
  },
  {
    term: "splice_region_variant",
    label: "splice region",
  },
  {
    term: "upstream_gene_variant",
    label: "upstream gene",
  },
];

export const VEP_CONSEQUENCE_LABELS: Map<string, string> = new Map();
RANKED_VEP_CONSEQUENCES.forEach(({ term, label }) => {
  VEP_CONSEQUENCE_LABELS.set(term, label);
});

export const PLOF_VEP_CONSEQUENCES = new Set(
  RANKED_VEP_CONSEQUENCES.slice(
    0,
    RANKED_VEP_CONSEQUENCES.findIndex(
      ({ term }) => term === "frameshift_variant"
    ) + 1
  ).map(({ term }) => term)
);
