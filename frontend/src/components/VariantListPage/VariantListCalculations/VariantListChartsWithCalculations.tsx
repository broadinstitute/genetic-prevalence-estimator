import { useMemo } from "react";
import {
  allVariantListCalculations,
  shouldCalculateContributionsBySource,
} from "./calculations";
import { Variant, VariantList } from "../../../types";

import VariantListCharts from "./VariantListCharts";

interface VariantListChartsWithCalculationsProps {
  variantList: VariantList;
  variants: Variant[];
}

const VariantListChartsWithCalculations = (
  props: VariantListChartsWithCalculationsProps
) => {
  const { variantList, variants } = props;

  const {
    carrierFrequency,
    carrierFrequencySimplified,
    prevalence,
    clinvarOnlyCarrierFrequency,
    clinvarOnlyCarrierFrequencySimplified,
    plofOnlyCarrierFrequency,
    plofOnlyCarrierFrequencySimplified,
  } = useMemo(() => allVariantListCalculations(variants, variantList), [
    variants,
    variantList,
  ]);

  return (
    <VariantListCharts
      genetic_ancestry_groups={variantList.metadata!.populations!}
      hasOptionToShowContributionsBySource={shouldCalculateContributionsBySource(
        variantList
      )}
      carrierFrequency={carrierFrequency!}
      carrierFrequencySimplified={carrierFrequencySimplified!}
      prevalence={prevalence!}
      clinvarOnlyCarrierFrequency={clinvarOnlyCarrierFrequency!}
      clinvarOnlyCarrierFrequencySimplified={
        clinvarOnlyCarrierFrequencySimplified!
      }
      plofOnlyCarrierFrequency={plofOnlyCarrierFrequency!}
      plofOnlyCarrierFrequencySimplified={plofOnlyCarrierFrequencySimplified!}
    />
  );
};

export default VariantListChartsWithCalculations;
