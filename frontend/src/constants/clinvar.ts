import { ClinvarClinicalSignificanceCategory } from "../types";

export const CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES: {
  [key in ClinvarClinicalSignificanceCategory]: Set<string>;
} = {
  pathogenic_or_likely_pathogenic: new Set([
    "association",
    "Likely_pathogenic",
    "Pathogenic",
    "Pathogenic/Likely_pathogenic",
    "risk_factor",
  ]),

  conflicting_interpretations: new Set([
    "conflicting_data_from_submitters",
    "Conflicting_interpretations_of_pathogenicity",
  ]),

  uncertain_significance: new Set(["Uncertain_significance"]),

  benign_or_likely_benign: new Set([
    "Benign",
    "Benign/Likely_benign",
    "Likely_benign",
  ]),

  other: new Set([
    "Affects",
    "association_not_found",
    "confers_sensitivity",
    "drug_response",
    "not_provided",
    "other",
    "protective",
  ]),
};
