import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
  Link,
  ListItem,
  Text,
  UnorderedList,
} from "@chakra-ui/react";
import { Link as RRLink } from "react-router-dom";

import DocumentTitle from "./DocumentTitle";
import DashboardContainer from "./DashboardPage/DashboardPage";

const FAQView = () => {
  return (
    <>
    <DashboardContainer/>
      <Heading as="h2" size="md" mt={4} mb={2}>
        Why do I need to sign in?
      </Heading>
      <Text>
        In order to store your variant lists, and allow you to edit them over
        time we need to have you signed in. By having users sign in we are also
        able to allow sharing lists across users, enabling collaboration.
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Why do you call this an Estimated Genetic Prevalence?
      </Heading>
      <Text mb={2}>
        <strong>Prevalence</strong> is the proportion of a population that has a
        specific characteristic in a given time period, regardless of when the
        characteristic first appears.
      </Text>
      <Text mb={2}>
        <strong>Incidence</strong> is the measure of the number of new cases
        with a specific characteristic in a population over a specified time
        period; (ex. cases per 100,000 births)
      </Text>
      <Text>
        Due to these definitions we believe that the calculations performed by
        this tool is most accurately defined as an{" "}
        <strong>estimated genetic prevalence</strong>, as it represents the
        estimated proportion of a population that has a causal genotype for a
        genetic disorder. These results should always be interpreted in the
        context of the disease/gene of interest. To learn more about
        considerations for these results please see our FAQ "What factors should
        I consider when interpreting these results?" To read more about how
        these estimates relate to prevalence, incidence and lifetime risk please
        read{" "}
        <Link
          href="https://www.cureffi.org/2019/06/05/using-genetic-data-to-estimate-disease-prevalence/"
          isExternal
        >
          "Using genetic data to estimate disease prevalence"
        </Link>
        .
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Why is this calculator not suited for autosomal dominant and x-linked
        conditions?
      </Heading>
      <Text>
        This method is designed for autosomal recessive disease. Individuals
        with rare disease are less likely to participate in or meet recruitment
        criteria for research studies that are included in reference population
        databases, so this method does not work for autosomal dominant or
        X-linked conditions. For the same reason, the depletion of symptomatic
        carriers could lower the allele frequencies of pathogenic variants
        observed in gnomAD. We are working on creating methods and tools for
        estimating genetic prevalence of AD and XL diseases and hope to add them
        in future versions.
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Why don’t I see all the populations in gnomAD in the graphs?
      </Heading>
      <Text>
        Clinical Genome Resource (ClinGen) Sequence Variant Interpretation
        Working Group has recommended only using allele frequencies when there
        are more than 2,000 reference alleles (
        <Link href="https://pubmed.ncbi.nlm.nih.gov/30311383/" isExternal>
          PMID: 30311383
        </Link>
        ). Due to this recommendation we only return results for subpopulations
        with more than 2,000 reference alleles.
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Why do I not see all known pathogenic variants in my list?
      </Heading>
      <Text>
        Since we use gnomAD as our reference database for allele frequencies we
        can only include variants that have been seen in 1 or more individuals
        in gnomAD. If a variant is absent from gnomAD, it will not be listed in
        your report, but that doesn’t not mean it is not pathogenic. It means
        that the variant is either low frequency, it is not well covered by
        exome and/or genome sequencing, or is present in a population not well
        represented in gnomAD. The variant could be in future versions of
        gnomAD, which is why we recommend reassessing these frequencies after
        new gnomAD releases.
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        What factors should I consider when interpreting these results?
      </Heading>
      <Text mb={2}>
        This tool provides an estimated carrier frequency and genetic
        prevalence. There are many factors that go into these estimates, which
        can influence the way you interpret the results.
      </Text>

      <Text mb={2}>
        Disease spectrum is an important part of interpreting genetic
        prevalence. The following factors should always be considered:
      </Text>
      <UnorderedList spacing={2} mb={2}>
        <ListItem>
          Symptomatic carriers: We use gnomAD as our source of allele
          frequencies for GeniE. Individuals with rare disease are less likely
          to participate in or meet recruitment criteria for research studies
          that are included in reference population databases. Depletion of
          symptomatic carriers could lower the allele frequencies of pathogenic
          variants observed in gnomAD.
        </ListItem>
        <ListItem>
          Impacts to life expectancy: Genetic prevalence represents the
          estimated proportion of a population that has a causal genotype for a
          genetic disorder, however it does not account for the possibility that
          specific allele combinations may lead to early misscarriage or
          neonatal loss. Some combinations could lead to loss of life early on,
          before the individual could be identified as having the clinical
          diagnosis.
        </ListItem>
        <ListItem>
          Reduced penetrance and variable expressivity: Similarly, the full
          phenotypic spectrum is still being discovered for many diseases. This
          final estimate does not currently take into consideration whether
          everyone with a casual genotype would present with the
          phenotype/disease of interest.
        </ListItem>
      </UnorderedList>

      <Text mb={2}>
        While genetic prevalence is an important part of answering, “How many
        people are there with X disease?”, additional methods of estimating
        incidence, prevalence, and lifetime risk should also be assessed when
        available. If these various methods are returning vastly different
        results some additional questions should be asked about the genetic
        prevalence estimates.
      </Text>

      <Text mb={2}>
        If you feel the estimate is to low (either globally or a specific
        population):
      </Text>
      <UnorderedList spacing={2} mb={2}>
        <ListItem>
          <em>
            Is the disease known to be more common in a population not well
            represented in gnomAD (e.g. Middle Eastern)?
          </em>{" "}
          Representation can have a big influence on these calculations if a
          variant is more common in a population that is not well represented in
          gnomAD, the disease-causing variant(s) could appear to be absent or
          rare in the population data.
        </ListItem>
        <ListItem>
          <em>
            What proportion of affected individuals have disease-causing
            variants detectable by exome or genome sequencing?
          </em>{" "}
          Variants in gnomAD have been identified via exome or genome
          sequencing. Variants not detectable by one for these two technologies
          will not be included in these estimates. Additionally, if a
          significant portion of patients with a clinical diagnosis are still
          missing a molecular diagnosis, that would mean that the full variant
          spectrum is not totally understood and would also lead to a lower
          estimated genetic prevalence.
        </ListItem>
        <ListItem>
          <em>Is the disease-gene relationship still relatively new?</em> It can
          take years to appreciate the full variant spectrums for a novel
          disease. During that time there can be fewer pathogenic variants known
          for a disease, which limits the number of allele frequencies included
          in the calculations. This can lead to lower than expected frequency
          information. One of the benefits of this tool is we will enable users
          to redo the calculations over time including more variants as they are
          collected.
        </ListItem>
      </UnorderedList>

      <Text mb={2}>
        If you feel the estimate is to high (either globally or a specific
        population):
      </Text>
      <UnorderedList spacing={2} mb={2}>
        <ListItem>
          <em>
            Are there any high frequency variants in your list that have
            questionable or unknown significance?
          </em>{" "}
          Even a single high frequency allele can dramatically impact the
          results so we recommend reviewing any high frequency variants to
          determine if they have a well established association with disease.
          You can unselect a variant to review the results without that allele
          included.
        </ListItem>
        <ListItem>
          <em>Do we know the full phenotypic spectrum of the gene?</em> As
          mentioned above, disease spectrum should always be considered in
          interpreting these results. Impacts to life expectancy, reduced
          penetrance and variable expressivity can all lead to estimated genetic
          prevalence being considerably higher than estimates based on a
          clinical diagnosis alone.
        </ListItem>
        <ListItem>
          <em>
            Does the gene, or specific regions of the gene, have lower than
            average allele numbers?
          </em>{" "}
          Allele frequencies are determined by allele count/allele number.
          Having lower allele numbers for a specific variant or region can
          inflate the frequencies. Clinical Genome Resource (ClinGen) Sequence
          Variant Interpretation Working Group has recommended only using allele
          frequencies when there are more than 2,000 reference alleles (
          <Link href="https://pubmed.ncbi.nlm.nih.gov/30311383/" isExternal>
            PMID: 30311383
          </Link>
          ).
        </ListItem>
      </UnorderedList>

      <Heading as="h2" size="md" mt={4} mb={2}>
        What are gnomAD and ClinVar and why do you use these databases for this
        tool?
      </Heading>
      <Text mb={2}>
        The{" "}
        <Link href="https://gnomad.broadinstitute.org/" isExternal>
          Genome Aggregation Database (gnomAD)
        </Link>{" "}
        is a database of aggregated exome and genome sequencing data contributed
        by a coalition of investigators. This database does not include
        individuals recruited for severe pediatric disease (e.g., cystic
        fibrosis and autism) as well as their first-degree relatives, allowing
        the database to largely represent the general population, making it
        ideal for our estimates.
      </Text>

      <Text>
        <Link href="https://www.ncbi.nlm.nih.gov/clinvar/" isExternal>
          ClinVar
        </Link>{" "}
        is a database of genomic variation and its relationship to human health.
        The variants and clinical significance listed in the database come
        largely from{" "}
        <Link
          href="https://www.ncbi.nlm.nih.gov/clinvar/docs/submitter_list/"
          isExternal
        >
          clinical genetic testing laboratories
        </Link>
        . Variant curation (the process used for determining clinical
        significance) guidelines have changed over time, so we do recommend
        reviewing the source data to determine if you feel the variant should be
        included in your calculations.
      </Text>
    </>
  );
};

const FAQPage = () => {
  return (
    <>
      <DocumentTitle title="FAQ" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>FAQ</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Frequently asked questions
      </Heading>

      <FAQView />
    </>
  );
};

export default FAQPage;
