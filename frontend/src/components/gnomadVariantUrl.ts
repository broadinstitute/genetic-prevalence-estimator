import { isStructuralVariantId } from "./identifiers";

const SMALL_VARIANT_DATASETS: Record<string, string> = {
  "2.1.1": "gnomad_r2_1",
  "3.1.2": "gnomad_r3",
  "4.0.0": "gnomad_r4",
  "4.0.0_non-ukb": "gnomad_r4",
  "4.1.0": "gnomad_r4",
  "4.1.0_non-ukb": "gnomad_r4",
  "4.1.1": "gnomad_r4",
  "4.1.2": "gnomad_r4",
};

const SMALL_VARIANT_DATASETS_BY_MAJOR_VERSION: Record<string, string> = {
  "2": "gnomad_r2_1",
  "3": "gnomad_r3",
  "4": "gnomad_r4",
};

const STRUCTURAL_VARIANT_DATASETS: Record<string, string> = {
  "2.1.1": "gnomad_sv_r2_1",
  "4.0.0": "gnomad_sv_r4",
  "4.0.0_non-ukb": "gnomad_sv_r4",
  "4.1.0": "gnomad_sv_r4",
  "4.1.0_non-ukb": "gnomad_sv_r4",
  "4.1.1": "gnomad_sv_r4",
  "4.1.2": "gnomad_sv_r4",
};

const STRUCTURAL_VARIANT_DATASETS_BY_MAJOR_VERSION: Record<string, string> = {
  "2": "gnomad_sv_r2_1",
  "4": "gnomad_sv_r4",
};

export const getGnomadVariantUrl = (
  variantId: string,
  gnomadVersion: string
): string => {
  const versionMatch = /^(\d+)\.\d+\.\d+(?:_non-ukb)?$/.exec(gnomadVersion);
  const majorVersion = versionMatch?.[1] ?? "";
  const isStructuralVariant = isStructuralVariantId(variantId, gnomadVersion);
  const dataset = isStructuralVariant
    ? STRUCTURAL_VARIANT_DATASETS[gnomadVersion] ??
      STRUCTURAL_VARIANT_DATASETS_BY_MAJOR_VERSION[majorVersion]
    : SMALL_VARIANT_DATASETS[gnomadVersion] ??
      SMALL_VARIANT_DATASETS_BY_MAJOR_VERSION[majorVersion];
  const browserVariantId = isStructuralVariant
    ? variantId.toUpperCase()
    : variantId;
  const datasetQuery = dataset ? `?dataset=${dataset}` : "";
  return `https://gnomad.broadinstitute.org/variant/${encodeURIComponent(
    browserVariantId
  )}${datasetQuery}`;
};
