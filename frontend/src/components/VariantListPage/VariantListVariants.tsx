import { Box, ListItem, Text, UnorderedList } from "@chakra-ui/react";

import { VariantList, VariantListType } from "../../types";

import { DownloadVariantListLink } from "./DownloadVariantList";
import VariantsTable from "./VariantsTable";

const VariantListVariants = (props: { variantList: VariantList }) => {
  const { variantList } = props;

  const { variants } = variantList;

  if (variants.length === 0) {
    if (
      variantList.type === VariantListType.RECOMMENDED &&
      (variantList.status === "Queued" || variantList.status === "Processing")
    ) {
      return (
        <Text mb={4}>
          Variants will be automatically populated for recommended variant
          lists.
        </Text>
      );
    }
    return <Text mb={4}>This variant list has no variants.</Text>;
  }

  return (
    <>
      <Text mb={2}>
        This variant list contains {variantList.variants.length} variant
        {variantList.variants.length !== 1 ? "s" : ""}.
      </Text>

      <Box mb={4}>
        <DownloadVariantListLink variantList={variantList}>
          Download variants
        </DownloadVariantListLink>
      </Box>

      {variantList.status === "Ready" ? (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <VariantsTable
            gnomadVersion={variantList.metadata.gnomad_version}
            variants={variantList.variants}
            mb={4}
          />
        </div>
      ) : (
        <UnorderedList mb={4}>
          {variantList.variants.map(({ id: variantId }) => (
            <ListItem key={variantId}>{variantId}</ListItem>
          ))}
        </UnorderedList>
      )}
    </>
  );
};

export default VariantListVariants;
