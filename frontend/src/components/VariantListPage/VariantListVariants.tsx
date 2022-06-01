import { QuestionIcon } from "@chakra-ui/icons";
import {
  Box,
  Checkbox,
  ListItem,
  Text,
  Tooltip,
  UnorderedList,
} from "@chakra-ui/react";
import { useState } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../constants/populations";
import {
  GnomadPopulationId,
  VariantId,
  VariantList,
  VariantListType,
} from "../../types";

import MultipleSelect from "../MultipleSelect";

import { DownloadVariantListLink } from "./DownloadVariantList";
import VariantsTable from "./VariantsTable";

interface VariantListVariantsProps {
  variantList: VariantList;
  selectedVariants: Set<VariantId>;
  onChangeSelectedVariants: (selectedVariants: Set<VariantId>) => void;
}

const VariantListVariants = (props: VariantListVariantsProps) => {
  const { variantList, selectedVariants, onChangeSelectedVariants } = props;

  const [
    populationsDisplayedInTable,
    setPopulationsDisplayedInTable,
  ] = useState<GnomadPopulationId[]>([]);
  const [includeAC0Variants, setIncludeAC0Variants] = useState(false);

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

  const numAC0Variants = variants.filter(
    (variant) => (variant.AC || [])[0] === 0
  ).length;

  return (
    <>
      <Text mb={2}>
        This variant list contains {variantList.variants.length} variant
        {variantList.variants.length !== 1 ? "s" : ""}.
      </Text>

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

          {numAC0Variants > 0 && (
            <Box mb={4}>
              <Checkbox
                isChecked={includeAC0Variants}
                onChange={(e) => setIncludeAC0Variants(e.target.checked)}
              >
                Show {numAC0Variants} variants that do not affect calculations
              </Checkbox>{" "}
              <Tooltip
                hasArrow
                label={
                  "If a variant failed quality control filters in the exomes or genomes " +
                  "sample set, then those samples are not included in the variant's allele " +
                  "count. Variants with an allele count of 0 do not affect carrier frequency " +
                  "and prevalence."
                }
                placement="top"
              >
                <QuestionIcon />
              </Tooltip>
            </Box>
          )}

          <Box mb={4}>
            <DownloadVariantListLink
              variantList={variantList}
              includePopulationFrequencies={populationsDisplayedInTable}
            >
              Download variants
            </DownloadVariantListLink>
          </Box>

          <div style={{ width: "100%", overflowX: "auto" }}>
            <VariantsTable
              includePopulationFrequencies={populationsDisplayedInTable}
              variantList={variantList}
              selectedVariants={selectedVariants}
              shouldShowVariant={
                includeAC0Variants
                  ? () => true
                  : (variant) => (variant.AC || [])[0] > 0
              }
              onChangeSelectedVariants={onChangeSelectedVariants}
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
