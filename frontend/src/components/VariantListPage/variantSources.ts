import { CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES } from "../../constants/clinvar";
import { PLOF_VEP_CONSEQUENCES } from "../../constants/vepConsequences";
import {
  Variant,
  VariantList,
  VariantListType,
  VariantSource,
} from "../../types";

export const getVariantSources = (
  variant: Variant,
  variantList: VariantList
): VariantSource[] => {
  // Originally, source was not stored on variants and was reconstructed on the frontend
  // from consequence and clinical significance. Thus, variants in older variants lists
  // will not have a source field.
  if (variant.source) {
    return variant.source;
  }

  const isIncludedFromClinvar =
    variantList.type === VariantListType.RECOMMENDED &&
    variantList.metadata.included_clinvar_variants?.some((category) =>
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
