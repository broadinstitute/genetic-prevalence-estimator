import { mapValues } from "lodash";
import { GnomadPopulationId, Variant, VariantList } from "../../../types";
import { getVariantSources } from "../variantSources";
import { RawCarrierFrequencyData } from "./calculationsDisplayFormats";

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

  const variantsTotalAlleleCountsAndNumbers = variants.reduce(
    (acc, variant) => {
      return acc.map((obj, i) => ({
        AC: obj.AC + variant.AC![i],
        AN: obj.AN + variant.AN![i],
      }));
    },
    Array.from(
      { length: variantList.metadata.populations!.length + 1 },
      () => ({
        AC: 0,
        AN: 0,
      })
    )
  );

  const length = variants.length;
  const carrierFrequencyRawNumbers = variantsTotalAlleleCountsAndNumbers.map(
    (total) => ({ total_ac: total.AC, average_an: total.AN / length })
  );

  const prevalence = totalAlleleFrequencies.map((q) => q ** 2);

  return {
    carrierFrequency,
    carrierFrequencySimplified,
    carrierFrequencyRawNumbers,
    prevalence,
  };
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
  | "carrierFrequencyRawNumbers"
  | "prevalence"
  | "clinvarOnlyCarrierFrequency"
  | "clinvarOnlyCarrierFrequencySimplified"
  | "clinvarOnlyCarrierFrequencyRawNumbers"
  | "plofOnlyCarrierFrequency"
  | "plofOnlyCarrierFrequencySimplified"
  | "plofOnlyCarrierFrequencyRawNumbers";

export type PopIdNumberRecord = Partial<Record<GnomadPopulationId, number>>;
export type PopIdRawCarrierNumberRecord = Partial<
  Record<GnomadPopulationId, RawCarrierFrequencyData>
>;

type VariantListCalculations = Record<
  Calculation,
  PopIdNumberRecord | PopIdRawCarrierNumberRecord | null
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
    carrierFrequencyRawNumbers,
    prevalence,
  } = calculateCarrierFrequencyAndPrevalence(variants, variantList);

  const {
    carrierFrequency: clinvarOnlyCarrierFrequency,
    carrierFrequencySimplified: clinvarOnlyCarrierFrequencySimplified,
    carrierFrequencyRawNumbers: clinvarOnlyCarrierFrequencyRawNumbers,
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
        carrierFrequencyRawNumbers: null,
      };

  const {
    carrierFrequency: plofOnlyCarrierFrequency,
    carrierFrequencySimplified: plofOnlyCarrierFrequencySimplified,
    carrierFrequencyRawNumbers: plofOnlyCarrierFrequencyRawNumbers,
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
        carrierFrequencyRawNumbers: null,
      };

  const allCalculations = {
    carrierFrequency,
    carrierFrequencySimplified,
    carrierFrequencyRawNumbers,
    prevalence,
    clinvarOnlyCarrierFrequency,
    clinvarOnlyCarrierFrequencySimplified,
    clinvarOnlyCarrierFrequencyRawNumbers,
    plofOnlyCarrierFrequency,
    plofOnlyCarrierFrequencySimplified,
    plofOnlyCarrierFrequencyRawNumbers,
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
