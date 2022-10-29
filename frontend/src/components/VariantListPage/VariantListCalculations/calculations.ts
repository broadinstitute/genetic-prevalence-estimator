import { Variant, VariantList } from "../../../types";
import { getVariantSources } from "../variantSources";

export const calculateCarrierFrequencyAndPrevalence = (
  variants: Variant[],
  variantList: VariantList
) => {
  const variantAlleleFrequencies = variants.map((variant) => {
    return variant.AC!.map((ac, i) => {
      const an = variant.AN![i];
      return an === 0 ? 0 : ac / an;
    });
  });

  const totalAlleleFrequencies = variantAlleleFrequencies.reduce(
    (acc, values) => acc.map((q, i) => q + values[i]),
    [0, ...variantList.metadata.populations!.map(() => 0)]
  );

  const carrierFrequency = totalAlleleFrequencies.map((q) => 2 * (1 - q) * q);

  const carrierFrequencySimplified = totalAlleleFrequencies.map((q) => 2 * q);

  const prevalence = totalAlleleFrequencies.map((q) => q ** 2);

  return { carrierFrequency, carrierFrequencySimplified, prevalence };
};

export const shouldCalculateContributionsBySource = (
  variantList: VariantList
) => {
  return (
    (variantList.metadata.include_clinvar_clinical_significance || []).length >
    0
  );
};

export const allVariantListCalculations = (
  variants: Variant[],
  variantList: VariantList
) => {
  const calculateContributionsBySource = shouldCalculateContributionsBySource(
    variantList
  );

  const {
    carrierFrequency,
    carrierFrequencySimplified,
    prevalence,
  } = calculateCarrierFrequencyAndPrevalence(variants, variantList);

  const {
    carrierFrequency: clinvarOnlyCarrierFrequency,
    carrierFrequencySimplified: clinvarOnlyCarrierFrequencySimplified,
  } = calculateContributionsBySource
    ? calculateCarrierFrequencyAndPrevalence(
        variants.filter((variant) =>
          getVariantSources(variant, variantList).includes("ClinVar")
        ),
        variantList
      )
    : {
        carrierFrequency: null,
        carrierFrequencySimplified: null,
      };

  const {
    carrierFrequency: plofOnlyCarrierFrequency,
    carrierFrequencySimplified: plofOnlyCarrierFrequencySimplified,
  } = calculateContributionsBySource
    ? calculateCarrierFrequencyAndPrevalence(
        variants.filter(
          (variant) =>
            !getVariantSources(variant, variantList).includes("ClinVar")
        ),
        variantList
      )
    : {
        carrierFrequency: null,
        carrierFrequencySimplified: null,
      };

  return {
    carrierFrequency,
    carrierFrequencySimplified,
    prevalence,
    clinvarOnlyCarrierFrequency,
    clinvarOnlyCarrierFrequencySimplified,
    plofOnlyCarrierFrequency,
    plofOnlyCarrierFrequencySimplified,
  };
};
