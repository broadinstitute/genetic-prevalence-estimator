import { ClinvarClinicalSignificanceCategory } from "../types";

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
    "not provided",
    "other",
    "protective",
  ]),
};
