import { Link, ListItem, Text, UnorderedList } from "@chakra-ui/react";

import { VariantList } from "../../types";

const getReferenceGenomeForVariantList = (variantList: VariantList) => {
  if (variantList.type === "custom") {
    return variantList.metadata.reference_genome;
  }

  if (variantList.type === "gnomad") {
    const gnomadVersion = variantList.metadata.gnomad_version;
    const majorVersion = gnomadVersion.split(".")[0];
    return majorVersion === "2" ? "GRCh37" : "GRCh38";
  }
};

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

  const referenceGenome = getReferenceGenomeForVariantList(variantList);
  const gnomadDataset =
    referenceGenome === "GRCh37" ? "gnomad_r2_1" : "gnomad_r3";

  return (
    <UnorderedList mb={4}>
      {variantList.variants.map((variantId) => (
        <ListItem key={variantId}>
          <Link
            href={`https://gnomad.broadinstitute.org/variant/${variantId}?dataset=${gnomadDataset}`}
            isExternal
            target="_blank"
          >
            {variantId}
          </Link>
        </ListItem>
      ))}
    </UnorderedList>
  );
};

export default VariantListVariants;
