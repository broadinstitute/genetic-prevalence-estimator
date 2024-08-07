import { Link } from "@chakra-ui/react";

import { VariantList, VariantListType } from "../../types";

import { DescriptionList, DescriptionListItem } from "../DescriptionList";

export const formatVariantListType = (variantList: VariantList) => {
  return variantList.type === VariantListType.RECOMMENDED
    ? "Recommended"
    : "Custom";
};

const clinvarDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
  timeZone: "UTC",
});

const formatClinvarReleaseDate = (releaseDate: string) => {
  const [year, month, day] = releaseDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return clinvarDateFormatter.format(date);
};

export const returnDomainOrLink = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (error) {
    console.log("Malformed URL:", error);
    return url;
  }
};

const VariantListMetadata = (props: { variantList: VariantList }) => {
  const { variantList } = props;

  const gnomadVersion = variantList.metadata.gnomad_version;
  const majorVersion = gnomadVersion.split(".")[0];
  const referenceGenome = majorVersion === "2" ? "GRCh37" : "GRCh38";
  const gnomadDataset =
    referenceGenome === "GRCh37" ? "gnomad_r2_1" : "gnomad_r4";

  return (
    <DescriptionList mb={4}>
      {variantList.supporting_documents &&
        variantList.supporting_documents.length > 0 && (
          <DescriptionListItem label="Supporting document">
            <Link
              href={variantList.supporting_documents[0].url}
              isExternal
              target="_blank"
            >
              {variantList.supporting_documents[0].title}
            </Link>
          </DescriptionListItem>
        )}
      <DescriptionListItem label="Type">
        {formatVariantListType(variantList)}
      </DescriptionListItem>
      <DescriptionListItem label="gnomAD version">
        {variantList.metadata.gnomad_version}
      </DescriptionListItem>
      <DescriptionListItem label="Reference genome">
        {variantList.metadata.reference_genome}
      </DescriptionListItem>
      {variantList.metadata.gene_id && (
        <DescriptionListItem label="Gene">
          <Link
            href={`https://gnomad.broadinstitute.org/gene/${
              variantList.metadata.gene_id.split(".")[0]
            }?dataset=${gnomadDataset}`}
            isExternal
            target="_blank"
          >
            {variantList.metadata.gene_symbol
              ? `${variantList.metadata.gene_symbol} (${variantList.metadata.gene_id})`
              : variantList.metadata.gene_id}
          </Link>
        </DescriptionListItem>
      )}
      {variantList.metadata.transcript_id && (
        <DescriptionListItem label="Transcript">
          <Link
            href={`https://gnomad.broadinstitute.org/transcript/${
              variantList.metadata.transcript_id.split(".")[0]
            }?dataset=${gnomadDataset}`}
            isExternal
            target="_blank"
          >
            {variantList.metadata.transcript_id}
          </Link>
        </DescriptionListItem>
      )}
      {variantList.metadata.include_clinvar_clinical_significance && (
        <DescriptionListItem label="Included ClinVar variants">
          {variantList.metadata.include_clinvar_clinical_significance
            .map((category) =>
              (category.charAt(0).toUpperCase() + category.slice(1))
                .split("_")
                .join(" ")
            )
            .join(", ")}
        </DescriptionListItem>
      )}
      {variantList.metadata.clinvar_version && (
        <DescriptionListItem label="ClinVar version">
          {formatClinvarReleaseDate(variantList.metadata.clinvar_version)}{" "}
          release
        </DescriptionListItem>
      )}
    </DescriptionList>
  );
};

export default VariantListMetadata;
