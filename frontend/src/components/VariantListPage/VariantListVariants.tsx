import { Link, Table, Thead, Tbody, Tr, Th, Td, Text } from "@chakra-ui/react";
import { FC } from "react";

import { VariantList, VariantListType } from "../../types";

import { renderVepConsequence } from "./vepConsequences";

const getReferenceGenomeForVariantList = (variantList: VariantList) => {
  if (variantList.type === VariantListType.CUSTOM) {
    return variantList.metadata.reference_genome;
  }

  if (variantList.type === VariantListType.RECOMMENDED) {
    const gnomadVersion = variantList.metadata.gnomad_version;
    const majorVersion = gnomadVersion.split(".")[0];
    return majorVersion === "2" ? "GRCh37" : "GRCh38";
  }
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

  const referenceGenome = getReferenceGenomeForVariantList(variantList);
  const gnomadDataset =
    referenceGenome === "GRCh37" ? "gnomad_r2_1" : "gnomad_r3";

  return (
    <>
      <Text mb={4}>
        This variant list contains {variantList.variants.length} variant
        {variantList.variants.length !== 1 ? "s" : ""}.
      </Text>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th scope="col">Variant ID</Th>
              {variantList.status === "Ready" && (
                <>
                  <Th scope="col">VEP consequence</Th>
                  <Th scope="col">LOFTEE</Th>
                  <Th scope="col">HGVSc</Th>
                  <Th scope="col">HGVSp</Th>
                  <Th scope="col" isNumeric>
                    Allele count
                  </Th>
                  <Th scope="col" isNumeric>
                    Allele number
                  </Th>
                  <Th scope="col" isNumeric>
                    Allele frequency
                  </Th>
                </>
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
                  {variantList.status === "Ready" && (
                    <>
                      <Td>
                        {variant.major_consequence
                          ? renderVepConsequence(variant.major_consequence)
                          : ""}
                      </Td>
                      <Td>{variant.lof}</Td>
                      <Td>
                        <Cell maxWidth={150}>{variant.hgvsc}</Cell>
                      </Td>
                      <Td>
                        <Cell maxWidth={150}>{variant.hgvsp}</Cell>
                      </Td>
                      <Td isNumeric>{renderCount(ac)}</Td>
                      <Td isNumeric>{renderCount(an)}</Td>
                      <Td isNumeric>{renderAlleleFrequency(af)}</Td>
                    </>
                  )}
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </div>
    </>
  );
};

export default VariantListVariants;
