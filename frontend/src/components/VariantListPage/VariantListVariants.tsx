import { QuestionIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Checkbox,
  HStack,
  ListItem,
  Text,
  Tooltip,
  UnorderedList,
} from "@chakra-ui/react";
import { useState } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../constants/populations";
import {
  GnomadPopulationId,
  Variant,
  VariantId,
  VariantList,
} from "../../types";

import MultipleSelect from "../MultipleSelect";

import { DownloadVariantListLink } from "./DownloadVariantList";
import VariantsTable from "./VariantsTable";

export const combineVariants = (
  variants: Variant[],
  structuralVariants: any[]
) => {
  const reshapedStructuralVariants = structuralVariants.map((sv: any) => {
    return {
      id: sv.id,
      hgvsc: `g.chr${sv.chrom}-${sv.pos}-${sv.end} ${sv.type}`,
      hgvsp: sv.length !== -1 ? sv.length : "-",
      lof: null,
      major_consequence: `${sv.consequence}-${sv.type}`,
      revel_score: null,
      gene_id: null,
      gene_symbol: null,
      transcript_id: null,
      AC: sv.AC,
      AN: sv.AN,
      sample_sets: ["genome"],
      filters: {
        exome: [],
        genome: [],
      },
      flags: [],
      clinvar_variation_id: null,
      clinical_significance: null,
      gold_stars: null,
      lof_curation: null,
      source: ["Custom"],
    };
  });

  const combinedVariants = variants.concat(
    reshapedStructuralVariants as Variant[]
  );
  return combinedVariants;
};

interface VariantListVariantsProps {
  variantList: VariantList;
  selectedVariants: Set<VariantId>;
  selectionDisabled: boolean;
  variantNotes: Record<VariantId, string>;
  userCanEdit: boolean;
  userIsStaff: boolean;
  onChangeSelectedVariants: (selectedVariants: Set<VariantId>) => void;
  onEditVariantNote: (variantId: VariantId, note: string) => void;
}

const VariantListVariants = (props: VariantListVariantsProps) => {
  const {
    selectedVariants,
    selectionDisabled,
    variantList,
    variantNotes,
    userCanEdit,
    userIsStaff,
    onChangeSelectedVariants,
    onEditVariantNote,
  } = props;

  const [
    populationsDisplayedInTable,
    setPopulationsDisplayedInTable,
  ] = useState<GnomadPopulationId[]>([]);
  const [includeAC0Variants, setIncludeAC0Variants] = useState(false);

  const { variants, structural_variants } = variantList;

  const renderedVariants = !structural_variants
    ? variants
    : combineVariants(variants, structural_variants);

  if (variants.length === 0) {
    if (
      (variantList.metadata.include_gnomad_plof ||
        (variantList.metadata.include_clinvar_clinical_significance || [])
          .length > 0) &&
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

  const numAC0Variants = renderedVariants.filter(
    (variant) => (variant.AC || [])[0] === 0
  ).length;

  return (
    <>
      <Text mb={2}>
        This variant list contains {renderedVariants.length} variant
        {variantList.variants.length !== 1 ? "s" : ""}.
      </Text>

      {variantList.status === "Ready" ? (
        <>
          <Box mb={4}>
            <HStack alignItems="flex-end">
              <MultipleSelect
                id="variant-table-included-population"
                label="Show population frequencies"
                options={variantList.metadata.populations!.map((popId) => ({
                  label: GNOMAD_POPULATION_NAMES[popId],
                  value: popId,
                }))}
                renderValue={(value) =>
                  `${value.length} of ${
                    variantList.metadata.populations!.length
                  } populations selected`
                }
                style={{ width: "auto" }}
                value={populationsDisplayedInTable}
                onChange={(value) =>
                  setPopulationsDisplayedInTable(value as GnomadPopulationId[])
                }
              />

              <Button
                onClick={() => {
                  setPopulationsDisplayedInTable(
                    variantList.metadata.populations!
                  );
                }}
              >
                Select all
              </Button>
              <Button
                onClick={() => {
                  setPopulationsDisplayedInTable([]);
                }}
              >
                Select none
              </Button>
            </HStack>
          </Box>

          {numAC0Variants > 0 && (
            <Box mb={4}>
              <Checkbox
                isChecked={includeAC0Variants}
                isDisabled={selectionDisabled}
                onChange={(e) => setIncludeAC0Variants(e.target.checked)}
              >
                Show {numAC0Variants} variants that do not impact calculations
              </Checkbox>{" "}
              <Tooltip
                hasArrow
                label={
                  "If a variant failed quality control filters in the exomes or genomes " +
                  "sample set, then those samples are not included in the variant's allele " +
                  "count. Variants with an allele count of 0 do not impact carrier frequency " +
                  "and prevalence."
                }
                placement="top"
              >
                <QuestionIcon />
              </Tooltip>
            </Box>
          )}

          <Box display="flex" mb={4}>
            <Box>
              <DownloadVariantListLink
                variantList={variantList}
                includePopulationFrequencies={populationsDisplayedInTable}
              >
                Download variants
              </DownloadVariantListLink>
            </Box>
          </Box>

          <div
            style={{
              width: "100%",
              overflowX: "auto",
              borderColor: "#edf2f7",
              borderStyle: "solid",
              borderWidth: "1px",
              boxShadow:
                "inset -0.65em 0em 1em -1.25em #000, inset 0.65em 0em 1em -1.25em #000",
              marginBottom: "1rem",
            }}
          >
            <VariantsTable
              userCanEdit={userCanEdit || userIsStaff}
              includePopulationFrequencies={populationsDisplayedInTable}
              variantList={variantList}
              selectedVariants={selectedVariants}
              shouldShowVariant={
                includeAC0Variants
                  ? () => true
                  : (variant) => (variant.AC || [])[0] > 0
              }
              variantNotes={variantNotes}
              onChangeSelectedVariants={onChangeSelectedVariants}
              onEditVariantNote={onEditVariantNote}
            />
          </div>
        </>
      ) : (
        <UnorderedList mb={4}>
          {renderedVariants.map(({ id: variantId }) => (
            <ListItem key={variantId}>{variantId}</ListItem>
          ))}
        </UnorderedList>
      )}
    </>
  );
};

export default VariantListVariants;
