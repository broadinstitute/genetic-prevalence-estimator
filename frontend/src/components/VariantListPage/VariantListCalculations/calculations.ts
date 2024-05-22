import { mapValues } from "lodash";
import { GnomadPopulationId, Variant, VariantList } from "../../../types";
import { getVariantSources } from "../variantSources";
import { RawCarrierFrequencyData } from "./calculationsDisplayFormats";

export const calculateCarrierFrequencyAndPrevalence = (
  variants: Variant[],
  variantList: VariantList,
  includeHomozygotes: boolean
) => {
  const variantAlleleFrequencies = variants.map((variant) => {
    return variant.AC!.map((ac, i) => {
      const homozygote_ac =
        !includeHomozygotes && variant.homozygote_count
          ? variant.homozygote_count[i] * 2
          : 0;

      const an = variant.AN![i];
      return an === 0 ? 0 : (ac - homozygote_ac) / an;
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
      return acc.map((obj, i) => {
        const homozygote_ac =
          !includeHomozygotes && variant.homozygote_count
            ? variant.homozygote_count[i] * 2
            : 0;
        return {
          AC: obj.AC + variant.AC![i] - homozygote_ac,
          AN: obj.AN + variant.AN![i],
        };
      });
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
  const multipliedAlleleFrequencies = variantAlleleFrequencies.reduce(
    (acc, values) => acc.map((q, i) => q * (1 - values[i])),
    [1, ...variantList.metadata.populations!.map(() => 1)]
  );
  const prevalenceBayesian = multipliedAlleleFrequencies.map((q) =>
    Math.pow(1 - q, 2)
  );

  return {
    carrierFrequency,
    carrierFrequencySimplified,
    carrierFrequencyRawNumbers,
    prevalence,
    prevalenceBayesian,
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

export type PopIdNumberRecord = Partial<Record<GnomadPopulationId, number>>;
export type PopIdRawCarrierNumberRecord = Partial<
  Record<GnomadPopulationId, RawCarrierFrequencyData>
>;

export type VariantListCalculations = {
  prevalence: PopIdNumberRecord;
  carrierFrequency: PopIdNumberRecord;
  carrierFrequencySimplified: PopIdNumberRecord;
  carrierFrequencyRawNumbers: PopIdRawCarrierNumberRecord;

  clinvarOnlyCarrierFrequency: PopIdNumberRecord | null;
  clinvarOnlyCarrierFrequencySimplified: PopIdNumberRecord | null;
  clinvarOnlyCarrierFrequencyRawNumbers: PopIdRawCarrierNumberRecord | null;

  plofOnlyCarrierFrequency: PopIdNumberRecord | null;
  plofOnlyCarrierFrequencySimplified: PopIdNumberRecord | null;
  plofOnlyCarrierFrequencyRawNumbers: PopIdRawCarrierNumberRecord | null;
};

export const allVariantListCalculations = (
  variants: Variant[],
  variantList: VariantList,
  includeHomozygotes: boolean
): VariantListCalculations => {
  const calculateContributionsBySource = shouldCalculateContributionsBySource(
    variantList
  );

  const {
    carrierFrequency,
    carrierFrequencySimplified,
    carrierFrequencyRawNumbers,
    prevalence,
    prevalenceBayesian,
  } = calculateCarrierFrequencyAndPrevalence(
    variants,
    variantList,
    includeHomozygotes
  );

  const {
    carrierFrequency: clinvarOnlyCarrierFrequency,
    carrierFrequencySimplified: clinvarOnlyCarrierFrequencySimplified,
    carrierFrequencyRawNumbers: clinvarOnlyCarrierFrequencyRawNumbers,
  } = calculateContributionsBySource
    ? calculateCarrierFrequencyAndPrevalence(
        variants.filter((variant) =>
          getVariantSources(variant, variantList).includes("ClinVar")
        ),
        variantList,
        includeHomozygotes
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
        variantList,
        includeHomozygotes
      )
    : {
        carrierFrequency: null,
        carrierFrequencySimplified: null,
        carrierFrequencyRawNumbers: null,
      };

  const fullListCalculations = {
    carrierFrequency,
    carrierFrequencySimplified,
    carrierFrequencyRawNumbers,
    prevalence,
    prevalenceBayesian,
  };

  const fullListValues = mapValues(fullListCalculations, (values) => {
    const value = Object.fromEntries(
      [
        "global",
        ...variantList.metadata.populations!,
      ].map((popId, popIndex) => [popId, values[popIndex]])
    );
    return value;
  });

  const partialLisCalculations = {
    clinvarOnlyCarrierFrequency,
    clinvarOnlyCarrierFrequencySimplified,
    clinvarOnlyCarrierFrequencyRawNumbers,
    plofOnlyCarrierFrequency,
    plofOnlyCarrierFrequencySimplified,
    plofOnlyCarrierFrequencyRawNumbers,
  };

  const partialListValues = mapValues(partialLisCalculations, (values) => {
    const value =
      values === null
        ? null
        : Object.fromEntries(
            [
              "global",
              ...variantList.metadata.populations!,
            ].map((popId, popIndex) => [popId, values[popIndex]])
          );
    return value;
  });

  const allValues = { ...partialListValues, ...fullListValues };

  return allValues;
};
