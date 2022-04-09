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
import { FC } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../constants/populations";
import { VEP_CONSEQUENCE_LABELS } from "../../constants/vepConsequences";
import {
  GnomadPopulationId,
  Variant,
  VariantId,
  VariantList,
  VariantListType,
} from "../../types";

import { getVariantSources } from "./variantSources";

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
  render: (
    variant: Variant,
    variantList: VariantList
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
    render: (variant, variantList) => {
      const gnomadVersion = variantList.metadata.gnomad_version;
      const gnomadDataset = {
        "2.1.1": "gnomad_r2_1",
        "3.1.2": "gnomad_r3",
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
    render: (variant) => {
      return variant.lof;
    },
  },
  {
    key: "hgvsc",
    heading: "HGVSc",
    render: (variant) => {
      return <Cell maxWidth={150}>{variant.hgvsc}</Cell>;
    },
  },
  {
    key: "hgvsp",
    heading: "HGVSp",
    render: (variant) => {
      return <Cell maxWidth={150}>{variant.hgvsp}</Cell>;
    },
  },
  {
    key: "clinical_significance",
    heading: "Clinical significance",
    render: (variant) => {
      return (
        variant.clinical_significance && (
          <Link
            href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${variant.clinvar_variation_id}/`}
            isExternal
            target="_blank"
          >
            {variant.clinical_significance?.join(", ")}
          </Link>
        )
      );
    },
  },
  {
    key: "ac",
    heading: "Allele count",
    isNumeric: true,
    render: (variant) => {
      const ac = (variant.AC || [])[0] || 0;
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
          {variant.flags?.includes("filtered") && (
            <Tooltip
              hasArrow
              label="Some samples are not included because this variant failed gnomAD quality control filters."
            >
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
        </Flex>
      );
    },
  },
  {
    key: "an",
    heading: "Allele number",
    isNumeric: true,
    render: (variant) => {
      return renderCount((variant.AN || [])[0] || 0);
    },
  },
  {
    key: "af",
    heading: "Allele frequency",
    isNumeric: true,
    render: (variant) => {
      const ac = (variant.AC || [])[0] || 0;
      const an = (variant.AN || [])[0] || 0;
      const af = ac === 0 ? 0 : ac / an;
      return renderAlleleFrequency(af);
    },
  },
];

const SOURCE_COLUMN: ColumnDef = {
  key: "source",
  heading: "Included from",
  render: (variant, variantList) => {
    if (variantList.type !== VariantListType.RECOMMENDED) {
      return null;
    }

    return getVariantSources(variant, variantList)
      .map((source) => {
        if (source === "ClinVar") {
          return (
            <Tooltip
              key="ClinVar"
              hasArrow
              label={`This variant was included from ClinVar, where it has a clinical significance in one of the included categories (${variantList.metadata.included_clinvar_variants
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
        } else {
          return (
            <Tooltip
              key="gnomAD"
              hasArrow
              label="This variant was included from gnomAD, where it is predicted loss of function with high confidence."
              maxWidth="500px"
            >
              gnomAD
            </Tooltip>
          );
        }
      })
      .flatMap((el) => [", ", el])
      .slice(1);
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
      render: (variant) => {
        const ac = (variant.AC || [])[popIndex] || 0;
        return renderCount(ac);
      },
    },
    {
      key: `pop-${popId}-an`,
      heading: `Allele number (${GNOMAD_POPULATION_NAMES[popId]})`,
      isNumeric: true,
      render: (variant) => {
        const an = (variant.AN || [])[popIndex] || 0;
        return renderCount(an);
      },
    },
    {
      key: `pop-${popId}-af`,
      heading: `Allele frequency (${GNOMAD_POPULATION_NAMES[popId]})`,
      isNumeric: true,
      render: (variant) => {
        const ac = (variant.AC || [])[popIndex] || 0;
        const an = (variant.AN || [])[popIndex] || 0;
        const af = ac === 0 ? 0 : ac / an;
        return renderAlleleFrequency(af);
      },
    },
  ];
};

interface VariantsTableProps extends TableProps {
  includePopulationFrequencies: GnomadPopulationId[];
  variantList: VariantList;
  selectedVariants: Set<VariantId>;
  onChangeSelectedVariants: (selectedVariants: Set<VariantId>) => void;
}

const VariantsTable: FC<VariantsTableProps> = ({
  includePopulationFrequencies,
  variantList,
  selectedVariants,
  onChangeSelectedVariants,
  ...tableProps
}) => {
  const columns = [
    ...BASE_COLUMNS,
    ...includePopulationFrequencies.flatMap((popId) =>
      populationAlleleFrequencyColumns(variantList, popId)
    ),
  ];
  if (variantList.type === VariantListType.RECOMMENDED) {
    columns.push(SOURCE_COLUMN);
  }

  return (
    <Table
      {...tableProps}
      size="sm"
      sx={{
        "& th:first-child, & td:first-child": {
          paddingLeft: "3px",
          paddingRight: "3px",
        },
        "& td:last-child, & th:last-child": { paddingRight: 0 },
      }}
    >
      <Thead>
        <Tr>
          <Th scope="col">
            <Checkbox
              isChecked={selectedVariants.size === variantList.variants.length}
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
              <VisuallyHidden>Include variants in calculations</VisuallyHidden>
            </Checkbox>
          </Th>
          {columns.map((column) => {
            return (
              <Th key={column.key} scope="col" isNumeric={column.isNumeric}>
                {column.heading}
              </Th>
            );
          })}
        </Tr>
      </Thead>
      <Tbody>
        {variantList.variants.map((variant) => {
          return (
            <Tr key={variant.id}>
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
              {columns.map((column) => {
                return (
                  <Td
                    key={column.key}
                    as={column.key === "variant_id" ? "th" : undefined}
                    scope={column.key === "variant_id" ? "row" : undefined}
                    fontWeight="normal"
                    isNumeric={column.isNumeric}
                  >
                    {column.render(variant, variantList)}
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
