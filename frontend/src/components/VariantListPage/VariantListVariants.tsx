import { QuestionIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Checkbox,
  HStack,
  List,
  ListItem,
  Text,
  Tooltip,
  UnorderedList,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Input,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { TaggedGroups, TagKey } from "./VariantListPage";
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
import HelpTextHover from "../HelpTextHover";

export const combineVariants = (
  variants: Variant[],
  structuralVariants: any[] | null
) => {
  if (!structuralVariants || structuralVariants.length === 0) {
    return variants;
  }
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
  taggedGroups: TaggedGroups;
  notIncludedVariants: Set<VariantId>;
  selectionDisabled: boolean;
  variantNotes: Record<VariantId, string>;
  userCanEdit: boolean;
  userIsStaff: boolean;
  onChangeNotIncludedVariants: (notIncludedVariants: Set<VariantId>) => void;
  onChangeSelectedVariants: (selectedVariants: Set<VariantId>) => void;
  onEditVariantNote: (variantId: VariantId, note: string) => void;
  onChangeTaggedGroups: (
    variantId: VariantId,
    taggedGroups: TaggedGroups
  ) => void;
}

const VariantListVariants = (props: VariantListVariantsProps) => {
  const {
    selectedVariants,
    taggedGroups,
    notIncludedVariants,
    selectionDisabled,
    variantList,
    variantNotes,
    userCanEdit,
    userIsStaff,
    onChangeNotIncludedVariants,
    onChangeSelectedVariants,
    onChangeTaggedGroups,
    onEditVariantNote,
  } = props;

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [
    populationsDisplayedInTable,
    setPopulationsDisplayedInTable,
  ] = useState<GnomadPopulationId[]>([]);
  const [includeAC0Variants, setIncludeAC0Variants] = useState(false);
  const [searchText, setSearchText] = useState("");

  const { variants, structural_variants } = variantList;

  const renderedVariants = combineVariants(variants, structural_variants);

  type DisplayNames = {
    A: string;
    B: string;
    C: string;
    D: string;
  };

  const handleEditTags = () => {
    onOpen();
  };

  const handleSaveDisplayNames = () => {
    const updatedGroups = { ...taggedGroups };

    (Object.keys(editDisplayNames) as Array<keyof DisplayNames>).forEach(
      (key) => {
        if (key in updatedGroups) {
          updatedGroups[key].displayName = editDisplayNames[key];
        }
      }
    );

    onChangeTaggedGroups("", updatedGroups);
    onClose();
  };

  const [editDisplayNames, setEditDisplayNames] = useState<DisplayNames>({
    A: taggedGroups.A.displayName,
    B: taggedGroups.B.displayName,
    C: taggedGroups.C.displayName,
    D: taggedGroups.D.displayName,
  });

  const tagCounts = {
    A: taggedGroups.A.variantList ? taggedGroups.A.variantList.size : 0,
    B: taggedGroups.B.variantList ? taggedGroups.B.variantList.size : 0,
    C: taggedGroups.C.variantList ? taggedGroups.C.variantList.size : 0,
    D: taggedGroups.D.variantList ? taggedGroups.D.variantList.size : 0,
  };

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

  const allUnincludedVariants = renderedVariants.filter(
    (variant) => !selectedVariants.has(variant.id)
  );
  const unselectedVariants = allUnincludedVariants.filter(
    (variant) => !notIncludedVariants.has(variant.id)
  );
  const neverIncludedVariants = renderedVariants.filter((variant) =>
    notIncludedVariants.has(variant.id)
  );

  const unselectedVariantsTooltip = (
    <>
      {unselectedVariants.length > 0 && (
        <>
          <Text>
            Currently unselected variant
            {unselectedVariants.length > 1 ? "s" : ""}:
          </Text>
          <List>
            {unselectedVariants.map((variant) => {
              return <ListItem pl={"2"}>• {variant.id}</ListItem>;
            })}
          </List>
        </>
      )}
      {neverIncludedVariants.length > 0 && (
        <>
          <Text>
            Currently fully excluded variant
            {neverIncludedVariants.length > 1 ? "s" : ""}:
          </Text>
          <List>
            {neverIncludedVariants.map((variant) => {
              return <ListItem pl={"2"}>• {variant.id}</ListItem>;
            })}
          </List>
        </>
      )}
    </>
  );

  return (
    <>
      <Text mb={2}>
        This variant list contains {renderedVariants.length} variant
        {variantList.variants.length !== 1 ? "s" : ""}.
      </Text>
      {allUnincludedVariants.length > 0 && (
        <>
          <Text mb={2}>
            {allUnincludedVariants.length} variant
            {allUnincludedVariants.length !== 1 ? "s are" : " is"} not currently
            included in the calculations.{" "}
            <HelpTextHover helpText={unselectedVariantsTooltip} />
          </Text>
        </>
      )}

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
                  } groups selected`
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
          <Box mb={4}>
            <Button onClick={handleEditTags}>Edit Tags</Button>
          </Box>
          <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Edit Tag Name</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack spacing={4} align="flex-start" width="100%">
                  {Object.keys(editDisplayNames).map((key) => {
                    const tagKey = key as TagKey;
                    const count = tagCounts[tagKey];
                    const displayName =
                      editDisplayNames[tagKey as keyof DisplayNames] ||
                      taggedGroups[tagKey].displayName;

                    return (
                      <Box key={tagKey} width="100%">
                        {count > 0 ? (
                          <Text>
                            {count} variant{count !== 1 ? "s" : ""} are tagged{" "}
                            <strong>{displayName}</strong>
                          </Text>
                        ) : (
                          <Text>
                            No variants are tagged{" "}
                            <strong>{displayName}</strong>
                          </Text>
                        )}
                        <Input
                          placeholder={`${key}`}
                          value={editDisplayNames[key as keyof DisplayNames]}
                          onChange={(e) =>
                            setEditDisplayNames({
                              ...editDisplayNames,
                              [key as keyof DisplayNames]: e.target.value,
                            })
                          }
                        />
                      </Box>
                    );
                  })}
                  <Button onClick={handleSaveDisplayNames} colorScheme="blue">
                    Save
                  </Button>
                </VStack>
              </ModalBody>
              <ModalFooter></ModalFooter>
            </ModalContent>
          </Modal>

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
          <Box mb={4}>
            <Input
              placeholder="Search variants"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
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
              searchText={searchText}
              variantList={variantList}
              selectedVariants={selectedVariants}
              taggedGroups={taggedGroups}
              notIncludedVariants={notIncludedVariants}
              shouldShowVariant={
                includeAC0Variants
                  ? () => true
                  : (variant) => (variant.AC || [])[0] > 0
              }
              variantNotes={variantNotes}
              onChangeNotIncludedVariants={onChangeNotIncludedVariants}
              onChangeSelectedVariants={onChangeSelectedVariants}
              onChangeTaggedGroups={onChangeTaggedGroups}
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
