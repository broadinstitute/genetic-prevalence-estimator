import { Link } from "@chakra-ui/react";

import { VariantList, GnomadVariantList, CustomVariantList } from "../../types";

import { DescriptionList, DescriptionListItem } from "../DescriptionList";

const CustomVariantListMetadata = (props: {
  variantList: CustomVariantList;
}) => {
  const { variantList } = props;

  return (
    <DescriptionList mb={4}>
      <DescriptionListItem label="Type">Custom</DescriptionListItem>
      <DescriptionListItem label="Reference genome">
        {variantList.metadata.reference_genome}
      </DescriptionListItem>
    </DescriptionList>
  );
};

const GnomadVariantListMetadata = (props: {
  variantList: GnomadVariantList;
}) => {
  const { variantList } = props;

  const gnomadVersion = variantList.metadata.gnomad_version;
  const majorVersion = gnomadVersion.split(".")[0];
  const referenceGenome = majorVersion === "2" ? "GRCh37" : "GRCh38";
  const gnomadDataset =
    referenceGenome === "GRCh37" ? "gnomad_r2_1" : "gnomad_r3";

  return (
    <DescriptionList mb={4}>
      <DescriptionListItem label="Type">gnomAD</DescriptionListItem>
      <DescriptionListItem label="Gene">
        <Link
          href={`https://gnomad.broadinstitute.org/gene/${variantList.metadata.gene_id}?dataset=${gnomadDataset}`}
          isExternal
          target="_blank"
        >
          {variantList.metadata.gene_id}
        </Link>
      </DescriptionListItem>
      <DescriptionListItem label="Included ClinVar variants">
        {variantList.metadata.included_clinvar_variants
          ? variantList.metadata.included_clinvar_variants
              .map((category) =>
                (category.charAt(0).toUpperCase() + category.slice(1))
                  .split("_")
                  .join(" ")
              )
              .join(", ")
          : "Any"}
      </DescriptionListItem>
    </DescriptionList>
  );
};

const VariantListMetadata = (props: { variantList: VariantList }) => {
  const { variantList } = props;

  if (variantList.type === "gnomad") {
    return <GnomadVariantListMetadata variantList={variantList} />;
  }

  if (variantList.type === "custom") {
    return <CustomVariantListMetadata variantList={variantList} />;
  }

  return null;
};

export default VariantListMetadata;
