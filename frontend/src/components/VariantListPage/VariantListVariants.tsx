import { ListItem, Text, UnorderedList } from "@chakra-ui/react";

import { VariantList } from "../../types";

const VariantListVariants = (props: { variantList: VariantList }) => {
  const { variantList } = props;

  const { variants } = variantList;

  if (variants.length === 0) {
    if (
      variantList.type === "gnomad" &&
      (variantList.status === "Queued" || variantList.status === "Processing")
    ) {
      return (
        <Text mb={4}>
          Variants will be automatically populated for gnomAD variant lists.
        </Text>
      );
    }
    return <Text mb={4}>This variant list has no variants.</Text>;
  }

  return (
    <UnorderedList mb={4}>
      {variantList.variants.map((variantId) => (
        <ListItem key={variantId}>{variantId}</ListItem>
      ))}
    </UnorderedList>
  );
};

export default VariantListVariants;
