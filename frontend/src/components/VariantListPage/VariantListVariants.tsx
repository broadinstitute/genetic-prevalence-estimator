import { Box, ListItem, Text, UnorderedList } from "@chakra-ui/react";
import { useState } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../constants/populations";
import { GnomadPopulationId, VariantList, VariantListType } from "../../types";

import MultipleSelect from "../MultipleSelect";

import { DownloadVariantListLink } from "./DownloadVariantList";
import VariantsTable from "./VariantsTable";

const VariantListVariants = (props: { variantList: VariantList }) => {
  const { variantList } = props;

  const [
    populationsDisplayedInTable,
    setPopulationsDisplayedInTable,
  ] = useState<GnomadPopulationId[]>([]);

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
        <>
          <Box mb={4}>
            <MultipleSelect
              id="variant-table-included-population"
              label="Show population frequencies"
              options={variantList.metadata.populations!.map((popId) => ({
                label: GNOMAD_POPULATION_NAMES[popId],
                value: popId,
              }))}
              value={populationsDisplayedInTable}
              onChange={(value) =>
                setPopulationsDisplayedInTable(value as GnomadPopulationId[])
              }
            />
          </Box>

          <div style={{ width: "100%", overflowX: "auto" }}>
            <VariantsTable
              includePopulationFrequencies={populationsDisplayedInTable}
              variantList={variantList}
              mb={4}
            />
          </div>
        </>
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
