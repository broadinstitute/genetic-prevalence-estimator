import { CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES } from "../../constants/clinvar";
import { PLOF_VEP_CONSEQUENCES } from "../../constants/vepConsequences";
import { RecommendedVariantList, Variant } from "../../types";

export type VariantSource = "ClinVar" | "gnomAD";

export const getVariantSources = (
  variant: Variant,
  variantList: RecommendedVariantList
): VariantSource[] => {
  const isIncludedFromClinvar = variantList.metadata.included_clinvar_variants?.some(
    (category) =>
      variant.clinical_significance?.some((clinicalSignificance) =>
        CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES[category].has(
          clinicalSignificance
        )
      )
  );

  const isIncludedFromGnomad =
    variant.major_consequence &&
    PLOF_VEP_CONSEQUENCES.has(variant.major_consequence) &&
    variant.lof === "HC";

  const reasons: VariantSource[] = [];
  if (isIncludedFromClinvar) {
    reasons.push("ClinVar");
  }
  if (isIncludedFromGnomad) {
    reasons.push("gnomAD");
  }

  return reasons;
};
