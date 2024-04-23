import { mapValues } from "lodash";
import { GnomadPopulationId, Variant, VariantList } from "../../../types";
import { getVariantSources } from "../variantSources";
import numpy as np

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

  const af: number[] = [0.01, 0.05, 0.1];
  const newPrevalenceModel = Math.pow(1 - numpy.prod(af.map(i => 1 - i)), 2);

  return { carrierFrequency, carrierFrequencySimplified, prevalence, newPrevalenceModel };
};

export const shouldCalculateContributionsBySource = (
  variantList: VariantList
) => {
  return (
    (variantList.metadata.include_clinvar_clinical_significance || []).length >
    0
  );
};

type Calculation =
  | "carrierFrequency"
  | "carrierFrequencySimplified"
  | "prevalence"
  | "clinvarOnlyCarrierFrequency"
  | "clinvarOnlyCarrierFrequencySimplified"
  | "plofOnlyCarrierFrequency"
  | "plofOnlyCarrierFrequencySimplified";

type VariantListCalculations = Record<
  Calculation,
  Partial<Record<GnomadPopulationId, number>> | null
>;

export const allVariantListCalculations = (
  variants: Variant[],
  variantList: VariantList
): VariantListCalculations => {
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

  const allCalculations = {
    carrierFrequency,
    carrierFrequencySimplified,
    prevalence,
    clinvarOnlyCarrierFrequency,
    clinvarOnlyCarrierFrequencySimplified,
    plofOnlyCarrierFrequency,
    plofOnlyCarrierFrequencySimplified,
  };

  return mapValues(allCalculations, (values) =>
    values === null
      ? null
      : Object.fromEntries(
          [
            "global",
            ...variantList.metadata.populations!,
          ].map((popId, popIndex) => [popId, values[popIndex]])
        )
  );
};
