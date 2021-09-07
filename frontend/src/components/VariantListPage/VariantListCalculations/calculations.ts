import { Variant, VariantList } from "../../../types";

export const calculateCarrierFrequencyAndPrevalence = (
  variants: Variant[],
  variantList: VariantList
) => {
  const zeros = [0, ...variantList.metadata.populations!.map(() => 0)];

  const alleleFrequencies = variants.map((variant) => {
    return variant.AC!.map((ac, i) => {
      const an = variant.AN![i];
      return an === 0 ? 0 : ac / an;
    });
  });

  const carrierFrequency = alleleFrequencies
    .map((af) => af.map((q) => 2 * (1 - q) * q))
    .reduce((acc, values) => acc.map((n, i) => n + values[i]), zeros);

  const carrierFrequencySimplified = alleleFrequencies
    .map((af) => af.map((q) => 2 * q))
    .reduce((acc, values) => acc.map((n, i) => n + values[i]), zeros);

  const prevalence = alleleFrequencies
    .map((af) => af.map((q) => q ** 2))
    .reduce((acc, values) => acc.map((n, i) => n + values[i]), zeros);

  return { carrierFrequency, carrierFrequencySimplified, prevalence };
};
