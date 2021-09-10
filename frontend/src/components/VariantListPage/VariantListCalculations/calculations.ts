import { Variant, VariantList } from "../../../types";

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
