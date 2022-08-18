import { Heading, Text } from "@chakra-ui/react";
import { intersection } from "lodash";
import { FC, Fragment } from "react";

import { ClinvarClinicalSignificanceCategory, VariantList } from "../../types";

const matches = (
  variantList: VariantList,
  includeGnomadPlof: boolean,
  includeClinvarClinicalSignificances: ClinvarClinicalSignificanceCategory[]
) => {
  return (
    (variantList.metadata.include_gnomad_plof || false) === includeGnomadPlof &&
    intersection(
      variantList.metadata.include_clinvar_clinical_significance || [],
      includeClinvarClinicalSignificances
    ).length === includeClinvarClinicalSignificances.length
  );
};

const VariantListCreationMethod: FC<{ variantList: VariantList }> = ({
  variantList,
}) => {
  if (matches(variantList, true, ["pathogenic_or_likely_pathogenic"])) {
    return (
      <Fragment>
        <Text mb={2}>
          The initial list of variants was created by collecting all ClinVar
          pathogenic and likely pathogenic variants in gnomAD for the gene and
          transcript specified by the user (see details above). The initial list
          also included all high confidence loss of function variants from
          gnomAD in the selected transcript. High confidence loss of function
          variants are defined as passing QC and the transcript consequences are
          in the set ("stop_gained", "frameshift_variant",
          "splice_acceptor_variant", "splice_donor_variant",
          "transcript_ablation").
        </Text>

        <Text mb={2}>
          Variants initially included in the list can be removed from the
          calculations either due to quality control filters or by users
          unselecting the variant from the list. Due to these factors, variants
          in gnomAD that meet the criteria above may not have been included in
          the final calculations. Please see the variant table for the final
          list of variants included in this report.
        </Text>
      </Fragment>
    );
  }

  if (
    matches(variantList, true, [
      "pathogenic_or_likely_pathogenic",
      "conflicting_interpretations",
    ])
  ) {
    return (
      <Fragment>
        <Text mb={2}>
          This initial list of variants was created by collecting all pathogenic
          and likely pathogenic variants from ClinVar in gnomAD, including any
          variants listed as “conflicting” where one or more submissions
          categorized the variant as pathogenic or likely pathogenic, for the
          gene and transcript specified by the user (see details above). The
          initial list also included all high confidence loss of function
          variants from gnomAD in the selected transcript. High confidence loss
          of function variants are defined as passing QC and the transcript
          consequences are in the set ("stop_gained", "frameshift_variant",
          "splice_acceptor_variant", "splice_donor_variant",
          "transcript_ablation").{" "}
        </Text>

        <Text mb={2}>
          Variants initially included in the list can be removed from the
          calculations either due to quality control filters or by users
          unselecting the variant from the list. Due to these factors, variants
          in gnomAD that meet the criteria above may not have been included in
          the final calculations. Please see the variant table for the final
          list of variants included in this report.
        </Text>
      </Fragment>
    );
  }

  if (
    matches(variantList, true, [
      "pathogenic_or_likely_pathogenic",
      "conflicting_interpretations",
      "uncertain_significance",
      "benign_or_likely_benign",
      "other",
    ])
  ) {
    return (
      <Fragment>
        <Text mb={2}>
          The initial list of variants was created by collecting all ClinVar
          variants in gnomAD, regardless of their classification, for the gene
          and transcript specified by the user (see details above). The initial
          list also included all high confidence loss of function variants from
          gnomAD in the selected transcript. High confidence loss of function
          variants are defined as passing QC and the transcript consequences are
          in the set ("stop_gained", "frameshift_variant",
          "splice_acceptor_variant", "splice_donor_variant",
          "transcript_ablation").
        </Text>

        <Text mb={2}>
          Variants initially included in the list can be removed from the
          calculations either due to quality control filters or by users
          unselecting the variant from the list. Due to these factors, variants
          in gnomAD that meet the criteria above may not have been included in
          the final calculations. Please see the variant table for the final
          list of variants included in this report.
        </Text>
      </Fragment>
    );
  }

  if (matches(variantList, true, [])) {
    return (
      <Fragment>
        <Text mb={2}>
          The initial list of variants was created by collecting all high
          confidence loss of function variants from gnomAD in the selected
          transcript. High confidence loss of function variants are defined as
          passing QC and the transcript consequences are in the set
          ("stop_gained", "frameshift_variant", "splice_acceptor_variant",
          "splice_donor_variant", "transcript_ablation").
        </Text>

        <Text mb={2}>
          Variants initially included in the list can be removed from the
          calculations either due to quality control filters or by users
          unselecting the variant from the list. Due to these factors, variants
          in gnomAD that meet the criteria above may not have been included in
          the final calculations. Please see the variant table for the final
          list of variants included in this report.
        </Text>
      </Fragment>
    );
  }

  if (matches(variantList, false, [])) {
    return (
      <Text mb={2}>
        Custom variant lists include variants from gnomAD selected by the user.
        All variants with a valid gnomAD ID are included in the initial list.
        Variants initially included in the list can be removed from the
        calculations either due to quality control filters or by users
        unselecting the variant from the list. Due to these factors, variants in
        gnomAD that meet the criteria above may not have been included in the
        final calculations. Please see the variant table for the final list of
        variants included in this report.
      </Text>
    );
  }

  return <p>How this variant list was created is unknown.</p>;
};

const Methods: FC<{ variantList: VariantList }> = ({ variantList }) => {
  return (
    <Fragment>
      <Heading as="h3" size="sm" mt={4} mb={2}>
        Variant List Creation
      </Heading>
      <VariantListCreationMethod variantList={variantList} />

      <Heading as="h3" size="sm" mt={4} mb={2}>
        Calculations{" "}
      </Heading>
      <Text mb={2}>
        Aggregate carrier frequency and genomic prevalence are calculated using
        the Hardy-Weinberg equation). All frequency annotations were collected
        across all the global and sub-continental ancestries in gnomAD v
        {variantList.metadata.gnomad_version} with more than 2,000 reference
        alleles (PMID: 30311383). Allele frequencies (AF) from all the variants
        in this list were added together to create an aggregate allele frequency
        (aAF). The aggregate carrier frequency was calculated by 2*aAF.
        Prevalence was calculated by squaring the aAF for all populations
        included (aAF<sup>2</sup>).
      </Text>

      <Heading as="h3" size="sm" mt={4} mb={2}>
        Population and subpopulation inference
      </Heading>
      <Text mb={2}>
        Continental ancestry was inferred using a PCA and random forest
        approach. Ancestries are assigned taking samples of known ancestry and
        then using the common genetic variants in the data to identify samples
        with genetic similarity. We do this by computing the top 20 principal
        components on the alternate allele counts for the same set of variants
        used in the PCRelate PCA and projecting the remaining related samples
        onto these principal components (Karczewski K, 2020; Supplementary Fig.
        1). The random forest model is then trained on a set of samples with
        known continental ancestry and used this model to assign continental
        ancestry labels to samples for which the random forest probability &gt;
        0.9. For additional details on population inference, including how the
        subpopulations were determined, please see pages 13-16 of the
        supplementary materials in Karczewski K, 2020 (PMID: 32461654).
      </Text>

      <Heading as="h3" size="sm" mt={4} mb={2}>
        Limitations
      </Heading>
      <Text mb={2}>
        This tool aims to estimate carrier frequency and disease prevalence for
        recessive conditions using population allele frequencies for a specified
        gene and transcript. There are many factors that go into calculating the
        estimated carrier frequencies and disease prevalence, such as available
        data in ClinVar (database of classified variants) and gnomAD (reference
        population database). These calculations are estimates and should be
        treated accordingly. This method is designed for autosomal recessive
        disease. Individuals with rare disease are less likely to participate in
        or meet recruitment criteria for research studies that are included in
        reference population databases, so this method does not work for
        autosomal dominant or X-linked conditions. For the same reason, the
        depletion of symptomatic carriers could lower the allele frequencies of
        pathogenic variants observed in gnomAD.
      </Text>

      <Text mb={2}>
        There are some reported pathogenic and likely pathogenic variants that
        are not found in gnomAD and therefore cannot be included in this
        analysis due to the absence of population frequencies. While gnomAD is
        the world&apos;s largest human reference database, it is not
        representative of the entire global population. Some populations and
        subpopulations are either underrepresented or still missing from gnomAD
        and more diversity of reference data is needed. We expect future
        releases of gnomAD to increase representation of diverse genetic
        ancestries; however, this is an area that will continue to need to be
        addressed. Finally, this calculation does not take into account the
        increased rates of consanguinity in some cultures which increase the
        prevalence of recessive conditions in these regions.{" "}
      </Text>
    </Fragment>
  );
};

export default Methods;
