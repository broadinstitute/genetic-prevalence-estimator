import {
  Badge,
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
} from "@chakra-ui/react";
import { FC } from "react";

import { CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES } from "../../constants/clinvar";
import {
  PLOF_VEP_CONSEQUENCES,
  VEP_CONSEQUENCE_LABELS,
} from "../../constants/vepConsequences";
import {
  RecommendedVariantList,
  Variant,
  VariantList,
  VariantListType,
} from "../../types";

type VariantSource = "ClinVar" | "gnomAD";

const getVariantSources = (
  variant: Variant,
  variantList: RecommendedVariantList
): VariantSource[] => {
  const isIncludedFromClinvar = variantList.metadata.included_clinvar_variants?.some(
    (category) =>
      variant.clinical_significance?.some((clinicalSignificance) =>
        CLINVAR_CLINICAL_SIGNIFICANCE_CATEGORIES[category].has(
          clinicalSignificance
        )
      )
  );

  const isIncludedFromGnomad =
    variant.major_consequence &&
    PLOF_VEP_CONSEQUENCES.has(variant.major_consequence) &&
    variant.lof === "HC";

  const reasons: VariantSource[] = [];
  if (isIncludedFromClinvar) {
    reasons.push("ClinVar");
  }
  if (isIncludedFromGnomad) {
    reasons.push("gnomAD");
  }

  return reasons;
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

interface VariantsTableProps extends TableProps {
  variantList: VariantList;
}

const VariantsTable: FC<VariantsTableProps> = ({
  variantList,
  ...tableProps
}) => {
  const gnomadVersion = variantList.metadata.gnomad_version;
  const gnomadDataset = {
    "2.1.1": "gnomad_r2_1",
    "3.1.1": "gnomad_r3",
  }[gnomadVersion];

  return (
    <Table {...tableProps} size="sm">
      <Thead>
        <Tr>
          <Th scope="col">Variant ID</Th>
          <Th scope="col">VEP consequence</Th>
          <Th scope="col">LOFTEE</Th>
          <Th scope="col">HGVSc</Th>
          <Th scope="col">HGVSp</Th>
          <Th scope="col">Clinical significance</Th>
          <Th scope="col" isNumeric>
            Allele count
          </Th>
          <Th scope="col" isNumeric>
            Allele number
          </Th>
          <Th scope="col" isNumeric>
            Allele frequency
          </Th>
          {variantList.type === VariantListType.RECOMMENDED && (
            <Th scope="col">Included from</Th>
          )}
        </Tr>
      </Thead>
      <Tbody>
        {variantList.variants.map((variant) => {
          const ac = (variant.AC || [])[0] || 0;
          const an = (variant.AN || [])[0] || 0;
          const af = ac === 0 ? 0 : ac / an;

          return (
            <Tr key={variant.id}>
              <Th scope="row" style={{ fontWeight: "normal" }}>
                <Cell maxWidth={200}>
                  <Link
                    href={`https://gnomad.broadinstitute.org/variant/${variant.id}?dataset=${gnomadDataset}`}
                    isExternal
                    target="_blank"
                  >
                    {variant.id}
                  </Link>
                </Cell>
              </Th>
              <Td>
                {variant.major_consequence
                  ? VEP_CONSEQUENCE_LABELS.get(variant.major_consequence)
                  : ""}
              </Td>
              <Td>{variant.lof}</Td>
              <Td>
                <Cell maxWidth={150}>{variant.hgvsc}</Cell>
              </Td>
              <Td>
                <Cell maxWidth={150}>{variant.hgvsp}</Cell>
              </Td>
              <Td>
                {variant.clinical_significance && (
                  <Link
                    href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${variant.clinvar_variation_id}/`}
                    isExternal
                    target="_blank"
                  >
                    {variant.clinical_significance?.join(", ")}
                  </Link>
                )}
              </Td>
              <Td isNumeric>
                <Flex as="span" justify="flex-end">
                  <span>{renderCount(ac)}</span>
                  {variant.flags?.includes("not_found") && (
                    <Tooltip
                      hasArrow
                      label="This variant is not found in gnomAD."
                    >
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
              </Td>
              <Td isNumeric>{renderCount(an)}</Td>
              <Td isNumeric>{renderAlleleFrequency(af)}</Td>
              {variantList.type === VariantListType.RECOMMENDED && (
                <Td>
                  {getVariantSources(variant, variantList)
                    .map((source) => {
                      if (source === "ClinVar") {
                        return (
                          <Tooltip
                            key="ClinVar"
                            hasArrow
                            label={`This variant was included from ClinVar, where it has a clinical significance in one of the included categories (${variantList.metadata.included_clinvar_variants
                              ?.map((category) =>
                                (
                                  category.charAt(0).toUpperCase() +
                                  category.slice(1)
                                )
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
                    .slice(1)}
                </Td>
              )}
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

export default VariantsTable;
