import { ClinvarClinicalSignificanceCategory } from "../types";

// These categories must stay in sync with CLINICAL_SIGNIFICANCE_CATEGORIES
// in data-pipelines/import_clinvar.py
export const CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES: {
  [key in ClinvarClinicalSignificanceCategory]: Set<string>;
} = {
  pathogenic_or_likely_pathogenic: new Set([
    "association",
    "Likely pathogenic",
    "Pathogenic",
    "Pathogenic/Likely pathogenic",
    "risk factor",
  ]),

  conflicting_interpretations: new Set([
    "conflicting data from submitters",
    "Conflicting interpretations of pathogenicity",
  ]),

  uncertain_significance: new Set(["Uncertain significance"]),

  benign_or_likely_benign: new Set([
    "Benign",
    "Benign/Likely benign",
    "Likely benign",
  ]),

  other: new Set([
    "Affects",
    "association not found",
    "confers sensitivity",
    "drug response",
    "Established risk allele",
    "Likely risk allele",
    "not provided",
    "other",
    "Pathogenic/Likely risk allele",
    "protective",
    "Uncertain risk allele",
  ]),
};
