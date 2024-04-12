import { ArrowDownIcon, ArrowUpIcon } from "@chakra-ui/icons";
import {
  Badge,
  Checkbox,
  Flex,
  Link,
  Table,
  TableProps,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tooltip,
  VisuallyHidden,
} from "@chakra-ui/react";
import { difference, intersection, sortBy } from "lodash";
import { FC, useCallback, useState } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../constants/populations";
import { VEP_CONSEQUENCE_LABELS } from "../../constants/vepConsequences";
import {
  GnomadPopulationId,
  Variant,
  VariantId,
  VariantList,
} from "../../types";

import { getVariantSources } from "./variantSources";
import { VariantNote } from "./VariantNote";

const variantAC = (variant: Variant, popIndex: number = 0) =>
  (variant.AC || [])[popIndex] || 0;

const variantAN = (variant: Variant, popIndex: number = 0) =>
  (variant.AN || [])[popIndex] || 0;

const variantAF = (variant: Variant, popIndex: number = 0) => {
  const ac = variantAC(variant, popIndex);
  return ac === 0 ? 0 : ac / variantAN(variant, popIndex);
};

const countFormatter = new Intl.NumberFormat(undefined, {});

const renderCount = (n: number) => {
  return countFormatter.format(n);
};

const renderAlleleFrequency = (af: number) => {
  const truncated = Number(af.toPrecision(3));
  if (truncated === 0 || truncated === 1) {
    return af.toFixed(0);
  } else {
    return truncated.toExponential(2);
  }
};

const formatList = (list: string[]) => {
  if (list.length === 0) {
    return "";
  }
  if (list.length === 1) {
    return list[0];
  }
  return `${list.slice(0, list.length - 1).join(", ")}${
    list.length > 2 ? "," : ""
  } and ${list[list.length - 1]}`;
};

const filteredVariantDescription = (variant: Variant) => {
  const base =
    "Some gnomAD samples are not included because this variant failed quality control filters";

  // Older variant lists may not have filters stored.
  if (!variant.filters) {
    return `${base}.`;
  }

  const exomeAndGenomeFilters = intersection(
    variant.filters.exome || [],
    variant.filters.genome || []
  );
  const exomeOnlyFilters = difference(
    variant.filters.exome || [],
    exomeAndGenomeFilters
  );
  const genomeOnlyFilters = difference(
    variant.filters.genome || [],
    exomeAndGenomeFilters
  );

  return (
    base +
    ": " +
    formatList(
      ([
        [exomeAndGenomeFilters, "exome and genome"],
        [exomeOnlyFilters, "exome"],
        [genomeOnlyFilters, "genome"],
      ] as [string[], string][])
        .filter(([filters, _]) => filters.length > 0)
        .map(([filters, samples]) => {
          return `${formatList(filters)} filters in ${samples} samples`;
        })
    ) +
    "."
  );
};

const Cell: FC<{ maxWidth: number }> = ({ children, maxWidth }) => {
  return (
    <span
      style={{
        display: "inline-block",
        maxWidth: `${maxWidth}px`,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};

interface ColumnDef {
  key: string;
  heading: string;
  isNumeric?: boolean;
  sortKey?: (
    variant: Variant,
    variantList: VariantList
  ) => string | number | (string | number)[];
  render: (
    variant: Variant,
    variantList: VariantList,
    variantNotes: Record<VariantId, string>,
    onEditVariantNote: (variantId: VariantId, note: string) => void,
    userCanEdit: boolean
  ) =>
    | JSX.Element
    | string
    | (JSX.Element | string)[]
    | null
    | undefined
    | false;
}

const BASE_COLUMNS: ColumnDef[] = [
  {
    key: "variant_id",
    heading: "Variant ID",
    sortKey: (variant) => {
      const [chrom, pos, ref, alt] = variant.id.split("-");
      return [chrom, Number(pos), ref, alt];
    },
    render: (variant, variantList) => {
      const gnomadVersion = variantList.metadata.gnomad_version;
      const gnomadDataset = {
        "2.1.1": "gnomad_r2_1",
        "3.1.2": "gnomad_r3",
        "4.0.0": "gnomad_r4",
      }[gnomadVersion];

      return (
        <Cell maxWidth={200}>
          <Link
            href={`https://gnomad.broadinstitute.org/variant/${variant.id}?dataset=${gnomadDataset}`}
            isExternal
            target="_blank"
          >
            {variant.id}
          </Link>
        </Cell>
      );
    },
  },
  {
    key: "consequence",
    heading: "VEP consequence",
    sortKey: (variant) =>
      (variant.major_consequence &&
        VEP_CONSEQUENCE_LABELS.get(variant.major_consequence)) ||
      "",
    render: (variant) => {
      return (
        variant.major_consequence &&
        VEP_CONSEQUENCE_LABELS.get(variant.major_consequence)
      );
    },
  },
  {
    key: "loftee",
    heading: "LOFTEE",
    sortKey: (variant) => variant.lof || "",
    render: (variant) => {
      return variant.lof;
    },
  },
  {
    key: "hgvsc",
    heading: "HGVSc",
    sortKey: (variant) => variant.hgvsc || "",
    render: (variant) => {
      return <Cell maxWidth={150}>{variant.hgvsc}</Cell>;
    },
  },
  {
    key: "hgvsp",
    heading: "HGVSp",
    sortKey: (variant) => variant.hgvsp || "",
    render: (variant) => {
      return <Cell maxWidth={150}>{variant.hgvsp}</Cell>;
    },
  },
  {
    key: "clinical_significance",
    heading: "Clinical significance",
    sortKey: (variant) => sortBy(variant.clinical_significance),
    render: (variant) => {
      return (
        variant.clinical_significance && (
          <Tooltip
            hasArrow
            label={`${variant.gold_stars} gold star${
              variant.gold_stars !== 1 ? "s" : ""
            }`}
          >
            <Link
              href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${variant.clinvar_variation_id}/`}
              isExternal
              target="_blank"
            >
              {variant.clinical_significance?.join(", ")}
            </Link>
          </Tooltip>
        )
      );
    },
  },
  {
    key: "ac",
    heading: "Allele count",
    isNumeric: true,
    sortKey: (variant) => variantAC(variant),
    render: (variant) => {
      const ac = variantAC(variant);
      return (
        <Flex as="span" justify="flex-end">
          <span>{renderCount(ac)}</span>
          {variant.flags?.includes("not_found") && (
            <Tooltip hasArrow label="This variant is not found in gnomAD.">
              <Badge
                colorScheme="red"
                fontSize="0.8em"
                mr={2}
                style={{ order: -1 }}
              >
                Not found
              </Badge>
            </Tooltip>
          )}
          {variant.flags?.includes("high_AF") && (
            <Tooltip
              hasArrow
              label="This variant has a higher allele frequency than the most common ClinVar pathogenic/likely pathogenic variant. It is important to establish whether this variant is disease-causing. Please use caution when including this variant in genetic prevalence estimates."
            >
              <Badge
                colorScheme="yellow"
                fontSize="0.8em"
                mr={2}
                style={{ order: -1 }}
              >
                High AF
              </Badge>
            </Tooltip>
          )}
          {variant.flags?.includes("filtered") && (
            <Tooltip hasArrow label={filteredVariantDescription(variant)}>
              <Badge
                colorScheme="yellow"
                fontSize="0.8em"
                mr={2}
                style={{ order: -1 }}
              >
                Filtered
              </Badge>
            </Tooltip>
          )}
          {variant.flags?.includes("has_homozygotes") && (
            <Tooltip hasArrow label={filteredVariantDescription(variant)}>
              <Badge
                colorScheme="yellow"
                fontSize="0.8em"
                mr={2}
                style={{ order: -1 }}
              >
                Homozygotes
              </Badge>
            </Tooltip>
          )}
          {variant.sample_sets && !variant.sample_sets.includes("exome") && (
            <Tooltip
              hasArrow
              label="This variant is found only in gnomAD genome samples."
            >
              <Badge
                colorScheme="yellow"
                fontSize="0.8em"
                mr={2}
                style={{ order: -1 }}
              >
                Genomes-only
              </Badge>
            </Tooltip>
          )}
        </Flex>
      );
    },
  },
  {
    key: "an",
    heading: "Allele number",
    isNumeric: true,
    sortKey: (variant) => variantAN(variant),
    render: (variant) => renderCount(variantAN(variant)),
  },
  {
    key: "af",
    heading: "Allele frequency",
    isNumeric: true,
    sortKey: (variant) => variantAF(variant),
    render: (variant) => renderAlleleFrequency(variantAF(variant)),
  },
];

const GENE_COLUMN: ColumnDef = {
  key: "gene",
  heading: "Gene",
  sortKey: (variant) => variant.gene_symbol || variant.gene_id || "",
  render: (variant) =>
    variant.gene_id && (
      <Tooltip hasArrow label={variant.gene_id}>
        {variant.gene_symbol || variant.gene_id}
      </Tooltip>
    ),
};

const TRANSCRIPT_COLUMN: ColumnDef = {
  key: "transcript",
  heading: "Transcript",
  sortKey: (variant) => variant.transcript_id || "",
  render: (variant) => variant.transcript_id,
};

const LOF_CURATION_COLUMN: ColumnDef = {
  key: "lof_curation",
  heading: "LoF curation",
  sortKey: (variant) => variant.lof_curation?.verdict || "",
  render: (variant) => {
    if (!variant.lof_curation) {
      return null;
    }

    if ((variant.lof_curation.flags || []).length > 0) {
      return (
        <Tooltip
          hasArrow
          label={`Contributing factors: ${variant.lof_curation.flags.join(
            ", "
          )}`}
        >
          {variant.lof_curation.verdict}
        </Tooltip>
      );
    }

    return variant.lof_curation.verdict;
  },
};

const SOURCE_COLUMN: ColumnDef = {
  key: "source",
  heading: "Source",
  sortKey: (variant, variantList) => getVariantSources(variant, variantList),
  render: (variant, variantList) => {
    return getVariantSources(variant, variantList)
      .map((source) => {
        switch (source) {
          case "ClinVar":
            return (
              <Tooltip
                key="ClinVar"
                hasArrow
                label={`This variant was included from ClinVar, where it has a clinical significance in one of the included categories (${variantList.metadata.include_clinvar_clinical_significance
                  ?.map((category) =>
                    (category.charAt(0).toUpperCase() + category.slice(1))
                      .split("_")
                      .join(" ")
                  )
                  .join(", ")}).`}
                maxWidth="500px"
              >
                ClinVar
              </Tooltip>
            );
          case "gnomAD":
            return (
              <Tooltip
                key="gnomAD"
                hasArrow
                label={`${
                  variant.major_consequence === "missense_variant"
                    ? "This variant was included from gnomAD, where it is a missense variant with a REVEL score greater than or equal to 0.932"
                    : "This variant was included from gnomAD, where it is predicted loss of function with high confidence"
                }`}
                maxWidth="500px"
              >
                gnomAD
              </Tooltip>
            );
          default:
            return source;
        }
      })
      .flatMap((el) => [", ", el])
      .slice(1);
  },
};

const NOTES_COLUMN: ColumnDef = {
  key: "note",
  heading: "Note",
  render: (
    variant,
    variantList,
    variantNotes,
    onEditVariantNote,
    userCanEdit
  ) => {
    const variantId = variant.id;
    return (
      <VariantNote
        variantId={variantId}
        note={variantNotes[variantId]}
        onEdit={(note) => onEditVariantNote(variantId, note)}
        userCanEdit={userCanEdit}
      />
    );
  },
};

const populationAlleleFrequencyColumns = (
  variantList: VariantList,
  popId: GnomadPopulationId
): ColumnDef[] => {
  const popIndex = variantList.metadata.populations!.indexOf(popId) + 1;

  return [
    {
      key: `pop-${popId}-ac`,
      heading: `Allele count (${GNOMAD_POPULATION_NAMES[popId]})`,
      isNumeric: true,
      sortKey: (variant) => variantAC(variant, popIndex),
      render: (variant) => renderCount(variantAC(variant, popIndex)),
    },
    {
      key: `pop-${popId}-an`,
      heading: `Allele number (${GNOMAD_POPULATION_NAMES[popId]})`,
      isNumeric: true,
      sortKey: (variant) => variantAN(variant, popIndex),
      render: (variant) => renderCount(variantAN(variant, popIndex)),
    },
    {
      key: `pop-${popId}-af`,
      heading: `Allele frequency (${GNOMAD_POPULATION_NAMES[popId]})`,
      isNumeric: true,
      sortKey: (variant) => variantAF(variant, popIndex),
      render: (variant) => renderAlleleFrequency(variantAF(variant, popIndex)),
    },
  ];
};

interface VariantsTableProps extends TableProps {
  userCanEdit: boolean;
  includePopulationFrequencies: GnomadPopulationId[];
  variantList: VariantList;
  selectedVariants: Set<VariantId>;
  shouldShowVariant: (variant: Variant) => boolean;
  variantNotes: Record<VariantId, string>;
  onChangeSelectedVariants: (selectedVariants: Set<VariantId>) => void;
  onEditVariantNote: (variantId: VariantId, note: string) => void;
  includeCheckboxColumn?: boolean;
  includeNotesColumn?: boolean;
}

type SortOrder = "ascending" | "descending";
interface SortState {
  key: string;
  order: SortOrder;
}
const useSort = (
  columns: ColumnDef[],
  defaultSortKey: string,
  defaultSortOrder: SortOrder = "ascending"
): [ColumnDef, SortOrder, (sortKey: string) => void] => {
  const defaultSortColumn = columns.find(
    (column) => column.key === defaultSortKey
  )!;
  const [sortState, setSortState] = useState<SortState>({
    key: defaultSortColumn.key,
    order: defaultSortOrder,
  });

  const setSortKey = useCallback(
    (sortKey: string) =>
      setSortState((prevSortState) => {
        if (sortKey === prevSortState.key) {
          return {
            ...prevSortState,
            order:
              prevSortState.order === "ascending" ? "descending" : "ascending",
          };
        }
        return { key: sortKey, order: "ascending" };
      }),
    []
  );

  const selectedSortColumn = columns.find(
    (column) => column.key === sortState.key
  );
  // A population specific column may be removed from the table while the table
  // is sorted by that column.
  if (!selectedSortColumn) {
    return [defaultSortColumn, "ascending", setSortKey];
  }
  return [selectedSortColumn, sortState.order, setSortKey];
};

const VariantsTable: FC<VariantsTableProps> = ({
  userCanEdit,
  includePopulationFrequencies,
  variantList,
  selectedVariants,
  shouldShowVariant,
  variantNotes,
  onChangeSelectedVariants,
  onEditVariantNote,
  includeCheckboxColumn = true,
  includeNotesColumn = true,
  ...tableProps
}) => {
  const columns = [
    ...(includeNotesColumn ? [NOTES_COLUMN] : []),
    ...BASE_COLUMNS,
    ...includePopulationFrequencies.flatMap((popId) =>
      populationAlleleFrequencyColumns(variantList, popId)
    ),
    SOURCE_COLUMN,
  ];

  if (!variantList.metadata.transcript_id) {
    columns.splice(
      columns.findIndex((col) => col.key === "consequence"),
      0,
      GENE_COLUMN,
      TRANSCRIPT_COLUMN
    );
  }

  if (variantList.variants.some((variant) => variant.lof_curation)) {
    columns.splice(
      columns.findIndex((col) => col.key === "loftee") + 1,
      0,
      LOF_CURATION_COLUMN
    );
  }

  const [sortColumn, sortOrder, setSortKey] = useSort(
    columns,
    "af",
    "descending"
  );

  const visibleVariants = variantList.variants.filter((variant) =>
    shouldShowVariant(variant)
  );
  const sortedVariants = sortBy(visibleVariants, (variant) =>
    sortColumn.sortKey!(variant, variantList)
  );
  if (sortOrder === "descending") {
    sortedVariants.reverse();
  }

  return (
    <Table
      {...tableProps}
      size="sm"
      sx={{
        "& th:first-child, & td:first-child": {
          paddingRight: "3px",
        },
      }}
    >
      <Thead>
        <Tr>
          {includeCheckboxColumn && (
            <Th scope="col">
              <Checkbox
                isChecked={
                  selectedVariants.size === variantList.variants.length
                }
                isIndeterminate={
                  selectedVariants.size > 0 &&
                  selectedVariants.size < variantList.variants.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    onChangeSelectedVariants(
                      new Set(variantList.variants.map((variant) => variant.id))
                    );
                  } else {
                    onChangeSelectedVariants(new Set());
                  }
                }}
              >
                <VisuallyHidden>
                  Include variants in calculations
                </VisuallyHidden>
              </Checkbox>
            </Th>
          )}
          {columns.map((column) => {
            return (
              <Th
                key={column.key}
                scope="col"
                isNumeric={column.isNumeric}
                aria-sort={
                  column.key === sortColumn.key ? sortOrder : undefined
                }
                style={{ position: "relative" }}
              >
                {column.sortKey ? (
                  <>
                    <button
                      style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        appearance: "none",
                        fontSize: "inherit",
                        fontWeight: "inherit",
                        textAlign: "inherit",
                      }}
                      onClick={() => {
                        setSortKey(column.key);
                      }}
                    >
                      {column.heading}
                    </button>
                    {column.key === sortColumn.key && (
                      <span
                        style={{
                          position: "absolute",
                          right: "3px",
                          top: "calc(50% - 10px)",
                        }}
                      >
                        {sortOrder === "descending" ? (
                          <ArrowDownIcon />
                        ) : (
                          <ArrowUpIcon />
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  column.heading
                )}
              </Th>
            );
          })}
        </Tr>
      </Thead>
      <Tbody>
        {sortedVariants.map((variant) => {
          return (
            <Tr key={variant.id}>
              {includeCheckboxColumn && (
                <Td>
                  <Checkbox
                    isChecked={selectedVariants.has(variant.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChangeSelectedVariants(
                          new Set([...selectedVariants, variant.id])
                        );
                      } else {
                        onChangeSelectedVariants(
                          new Set(
                            [...selectedVariants].filter(
                              (variantId) => variantId !== variant.id
                            )
                          )
                        );
                      }
                    }}
                  >
                    <VisuallyHidden>
                      Include this variant in calculations
                    </VisuallyHidden>
                  </Checkbox>
                </Td>
              )}
              {columns.map((column) => {
                return (
                  <Td
                    key={column.key}
                    as={column.key === "variant_id" ? "th" : undefined}
                    scope={column.key === "variant_id" ? "row" : undefined}
                    fontWeight="normal"
                    isNumeric={column.isNumeric}
                  >
                    {column.render(
                      variant,
                      variantList,
                      variantNotes,
                      onEditVariantNote,
                      userCanEdit
                    )}
                  </Td>
                );
              })}
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

export default VariantsTable;
