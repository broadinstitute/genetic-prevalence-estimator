import { useMemo } from "react";
import {
  allVariantListCalculations,
  PopIdNumberRecord,
  PopIdRawCarrierNumberRecord,
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
    carrierFrequencyRawNumbers,
    prevalence,
    clinvarOnlyCarrierFrequency,
    clinvarOnlyCarrierFrequencySimplified,
    clinvarOnlyCarrierFrequencyRawNumbers,
    plofOnlyCarrierFrequency,
    plofOnlyCarrierFrequencySimplified,
    plofOnlyCarrierFrequencyRawNumbers,
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
      carrierFrequency={carrierFrequency! as PopIdNumberRecord}
      carrierFrequencySimplified={
        carrierFrequencySimplified! as PopIdNumberRecord
      }
      carrierFrequencyRawNumbers={
        carrierFrequencyRawNumbers! as PopIdRawCarrierNumberRecord
      }
      prevalence={prevalence! as PopIdNumberRecord}
      clinvarOnlyCarrierFrequency={
        clinvarOnlyCarrierFrequency! as PopIdNumberRecord
      }
      clinvarOnlyCarrierFrequencySimplified={
        clinvarOnlyCarrierFrequencySimplified! as PopIdNumberRecord
      }
      clinvarOnlyCarrierFrequencyRawNumbers={
        clinvarOnlyCarrierFrequencyRawNumbers! as PopIdRawCarrierNumberRecord
      }
      plofOnlyCarrierFrequency={plofOnlyCarrierFrequency! as PopIdNumberRecord}
      plofOnlyCarrierFrequencySimplified={
        plofOnlyCarrierFrequencySimplified! as PopIdNumberRecord
      }
      plofOnlyCarrierFrequencyRawNumbers={
        plofOnlyCarrierFrequencyRawNumbers! as PopIdRawCarrierNumberRecord
      }
    />
  );
};

export default VariantListChartsWithCalculations;
