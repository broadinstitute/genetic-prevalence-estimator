import { ClinvarClinicalSignificanceCategory } from "../types";

// These categories must stay in sync with CLINICAL_SIGNIFICANCE_CATEGORIES
// in data-pipelines/import_clinvar.py
export const CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES: {
  [key in ClinvarClinicalSignificanceCategory]: Set<string>;
} = {
  pathogenic_or_likely_pathogenic: new Set([
    "association",
    "Likely pathogenic",
    "Likely pathogenic, low penetrance",
    "Likely pathogenic/Likely risk allele",
    "Likely pathogenic/Pathogenic",
    "Likely pathogenic/Likely pathogenic",
    "Pathogenic",
    "Pathogenic, low penetrance",
    "Pathogenic/Pathogenic",
    "Pathogenic/Likely pathogenic",
    "Pathogenic/Likely risk allele",
    "Pathogenic/Likely pathogenic/Likely risk allele",
    "Pathogenic/Likely pathogenic/Established risk allele",
    "Pathogenic/Likely pathogenic/Pathogenic",
    "Pathogenic/Likely pathogenic/Likely pathogenic",
  ]),

  conflicting_interpretations: new Set([
    "conflicting data from submitters",
    "Conflicting interpretations of pathogenicity",
    "Conflicting classifications of pathogenicity",
  ]),

  uncertain_significance: new Set([
    "Uncertain significance",
    "Uncertain significance/Uncertain risk allele",
    "Uncertain significance/VUS-high",
    "Uncertain significance/VUS-mid",
    "Uncertain significance/VUS-low",
  ]),

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
    "risk factor",
    "low penetrance",
    "low penetrance/Established risk allele",
    "not provided",
    "other",
    "protective",
    "Uncertain risk allele",
    "no classification for the single variant",
    "no classifications from unflagged records",
    "VUS-high",
    "VUS-mid",
    "VUS-low",
    "-",
  ]),
};
