import { Variant, VariantList, VariantListType } from "../../../types";

import CustomVariantListCalculations from "./CustomVariantListCalculations";
import RecommendedVariantListCalculations from "./RecommendedVariantListCalculations";

interface VariantListCalculationsProps {
  variantList: VariantList;
  variants: Variant[];
}

const VariantListCalculations = (props: VariantListCalculationsProps) => {
  const { variantList, variants } = props;

  if (variantList.type === VariantListType.CUSTOM) {
    return (
      <CustomVariantListCalculations
        variants={variants}
        variantList={variantList}
      />
    );
  }

  if (variantList.type === VariantListType.RECOMMENDED) {
    return (
      <RecommendedVariantListCalculations
        variants={variants}
        variantList={variantList}
      />
    );
  }

  return null;
};

export default VariantListCalculations;
