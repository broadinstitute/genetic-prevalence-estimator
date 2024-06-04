import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
  Link as ChakraLink,
  ListItem,
  Text,
  UnorderedList,
  Badge,
} from "@chakra-ui/react";
import { Link as RRLink, useLocation } from "react-router-dom";
import Link from "./Link";

import DocumentTitle from "./DocumentTitle";
import { useState, useEffect } from "react";

const slugTitle = (title: string) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "-")
    .trim();
};

const FAQItem = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const id = slugTitle(title);

  return (
    <AccordionItem key={id} id={id}>
      <AccordionButton>
        <Heading as="h2" size="md" mt={4} mb={2} flex="1" textAlign="left">
          {title}
        </Heading>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4} mb={2}>
        {children}
      </AccordionPanel>
    </AccordionItem>
  );
};

const faqs = [
  {
    title: "Why do I need to log in?",
    answer: (
      <Text>
        In order to store your variant lists and allow you to edit them over
        time, we need to have you logged into a Google account. By having users
        log in, we are also able to allow for sharing of lists across users,
        enabling collaboration.
      </Text>
    ),
  },
  { title: "How do you pronounce GeniE?", answer: <Text>Jee · nee</Text> },
  {
    title: "Why do you call this an Estimated Genetic Prevalence?",
    answer: (
      <>
        <Text mb={2}>
          <strong>Prevalence</strong> is the proportion of a population that has
          a specific characteristic in a given time period. Example: "1 in 10
          Americans has Type 2 diabetes"
        </Text>
        <Text mb={2}>
          <strong>Incidence</strong> is the measure of the number of new cases
          with a specific characteristic or disease in a population over a
          specified time period. Example: "Every year, 1 in every 600 women is
          diagnosed with breast cancer"
        </Text>
        <Text>
          Due to these definitions we believe that the calculations performed by
          this tool is most accurately defined as an{" "}
          <strong>estimated genetic prevalence</strong>, as it represents the
          estimated proportion of a population that will have a genotype for a
          genetic disorder, irrespective of penetrance, age of onset, and other
          factors affecting the disease prevalence. These results should always
          be interpreted in the context of the disease/gene of interest. To
          learn more about considerations for these results please see our FAQ{" "}
          <Link
            to={{
              pathname: "/faq",
              hash:
                "what-factors-should-i-consider-when-interpreting-these-results",
            }}
          >
            "What factors should I consider when interpreting these results?"
          </Link>
          . To read more about how these estimates relate to prevalence,
          incidence and lifetime risk please read{" "}
          <ChakraLink
            href="https://www.cureffi.org/2019/06/05/using-genetic-data-to-estimate-disease-prevalence/"
            isExternal
          >
            "Using genetic data to estimate disease prevalence"
          </ChakraLink>
          .
        </Text>
      </>
    ),
  },
  {
    title:
      "Is the Estimated Genetic Prevalence the same as disease prevalence?",
    answer: (
      <Text>
        No. Genetic prevalence correlates but does not equate to disease
        prevalence (PMID: 34078906). Genetic prevalence refers to the proportion
        of a population that has a causal genotype for a specific genetic
        disorder, irrespective of whether these individuals will or will not
        manifest the disease. For instance, if the causative genotype is not
        fully penetrant, then the estimated genetic prevalence will be higher
        than actual disease prevalence. To learn more about the factors that
        shape the estimated genetic prevalence, please read{" "}
        <Link
          to={{
            pathname: "/faq",
            hash:
              "what-factors-should-i-consider-when-interpreting-these-results",
          }}
        >
          "What factors should I consider when interpreting these results?"
        </Link>
        .
      </Text>
    ),
  },
  {
    title:
      "What method does GeniE use to calculate carrier frequency and genetic prevalence?",
    answer: (
      <>
        <Text>
          GeniE offers multiple methods for calculating carrier frequency and
          genetic prevalence, allowing users to easily compare and constrast the
          various methods and find the one that works best for their
          gene/disease of interest. All of these methods are based primarily on
          the{" "}
          <ChakraLink
            href="https://en.wikipedia.org/wiki/Hardy-Weinberg_principle"
            isExternal
          >
            Hardy-Weinberg principle
          </ChakraLink>{" "}
          (HW):
          <Text ml={8} mt={8}>
            <strong>
              P<sup>2</sup> + 2pq + q<sup>2</sup> = 1
            </strong>
          </Text>
          <UnorderedList listStyleType="none" ml={12} mt={4} mb={8}>
            <ListItem>
              p<sup>2</sup> = homozygous reference allele frequency (AA)
            </ListItem>
            <ListItem>
              2pq = heterozygous variant allele frequency (Aa)
            </ListItem>
            <ListItem>
              q<sup>2</sup> = homozygous variant allele frequency (aa)
            </ListItem>
          </UnorderedList>
        </Text>

        <Text>
          <strong>Carrier frequency methods:</strong>
        </Text>
        <Text mt={4}>
          For the purposes of genetic prevalence, <i>q</i> equals the sum of the
          allele frequences (AF) for all variants included in the designated
          variant list (note: variants can be excluded from the sum by
          unchecking the box next to the variant name). Thre are four options
          for calculating carrier frequency in GeniE:
        </Text>
        <Text mt={4}>
          <i>Full (2pq):</i> This method takes into account the aggregate allele
          frequency of p, which is equal to 1-q.
        </Text>
        <Text mt={4}>
          <i>Simplified (2q):</i> In rare disease, p is so close to 1 that it
          can be excluded from the formula. This model is often used in rare
          disease to simplify the math.
        </Text>
        <Text>
          <i>Remove gnomAD homozygotes:</i> This version of the formula will
          subtract the homozygous counts for any variant in the list that has
          homozygotes in gnomAD before performing the calculations via the
          formula:{" "}
          <Text ml={8} mt={8}>
            AC - 2 * (# of homozygotes)
          </Text>
          <Text ml={12} mt={4} mb={8}>
            AC = allele count of a particular variant
          </Text>
          This approach might be taken if there is concern that homozygous
          variants seen in the general population as represented by gnomaD may
          not be pathogenic. For some recessive conditions, there are
          hypomorphic or mild variants that can cause disease when in trans to a
          more severe variant but do not cause disease in the homozygous state.
        </Text>
        <Text mt={4}>
          <i>Raw numbers:</i> This option shows you the sum total of the allele
          counts for all variants included over the average allele number (AN)
          for all variants included within that ancestry group. Note: the AN can
          vary for each variant due to differences in coverage across regions of
          a gene and/or limitations of exomes.{" "}
        </Text>

        <Text mt={8}>
          <strong>Genetic prevalence methods:</strong>
        </Text>
        <Text mt={4}>
          <i>
            Simplified (q<sup>2</sup>):
          </i>
          This method calculates prevalence by squaring the sum of all AFs for
          variants included in the variant list (q).
        </Text>
        <Text mt={4}>
          <i>Bayesian method:</i> This model assumes linkage equilibrium across
          the variants, whcih can make a sligh difference in the estimates for
          more common recessive diseases. The formula (below) used for this
          method is based on Schrodi et al 2015 (
          <ChakraLink
            href="https://pubmed.ncbi.nlm.nih.gov/25893794/"
            isExternal
          >
            PMID: 25893794
          </ChakraLink>
          )
          <Text ml={8} mt={4}>
            (1 - &prod;<sub>i=1</sub>
            <sup>k</sup>(1 - p<sub>i</sub>))<sup>2</sup>
          </Text>
          <Text ml={12} mt={4} mb={8}>
            p<sub>i</sub> = the frequency of the "i"th pathogenic variant in the
            populage studied, assuming linkage equilibrium across the variants.
            This converges to (1 - &sum;<sub>i=1</sub>
            <sup>k</sup>(1 - p<sub>i</sub>))<sup>2</sup> as the frequencies go
            to 0.
          </Text>
        </Text>

        <Text>
          <strong>Display options</strong>:
        </Text>

        <Text mt={4}>
          For both carrier frequency and genetic prevalence the user is given a
          variety of options for displaying the reuslts, including fraction and
          scientific notation. For genetic prevalence, we also provide the
          option to see the results as "per 100,00" which is a common metric in
          epidemiology.
        </Text>

        <Text mt={4}>
          Users can also compare the results by source (gnomaD vs ClinVar), and
          choose whether or not to include sub genetic ancestry group estimates
          (gnomAD v2.1.1 only)
        </Text>
      </>
    ),
  },
  {
    title: "What types of variants does GeniE support?",
    answer: (
      <Text>
        GeniE supports gnomAD single nucleotide variants (SNVs), small
        insertions and deletions (indels), and structural variants (SVs).
      </Text>
    ),
  },
  {
    title: "How do I add structural variants to a variant list?",
    answer: (
      <>
        <Text>
          Currently, structural variants (SVs) can only be added via creation of
          a manual list, or by adding the variant{" "}
          <Link
            to={{
              pathname: "/faq",
              hash:
                "how-do-i-add-or-remove-variants-after-a-variant-list-is-created",
            }}
          >
            manually
          </Link>{" "}
          after a recommended list is created.
        </Text>

        <Text mt={4}>
          Please note: for gnomAD v2 SVs there are fewer genetic ancestry groups
          for both the non-Finnish european and Finnish ancestry groups are
          included in the "European" ancestry group. For the purposes of display
          in GeniE, we have included the v2 SV "European" genetic ancestry group
          in the "European (non-Finnish)" group.
        </Text>
      </>
    ),
  },
  {
    title: "How do I add or remove variants after a variant list is created?",
    answer: (
      <Text>
        To add more variants to a list after a variant list is created, select
        the '+' button next to the "Variants" header. At this time, variants
        cannot be completely removed from the list after it is created, but can
        be excluded from the calculations by unchecking the box next to the
        gnomAD ID in the variant table.
      </Text>
    ),
  },
  {
    title: "What are the possible flags in GeniE?",
    answer: (
      <Text>
        GeniE provides flags to bring attention to certain aspects of variants
        in variant list, or genes on the dashboard. The possible flags are:
        <Text mt={4}>
          <strong>Variant</strong>
        </Text>
        <UnorderedList listStyleType="none" mt={4} mb={4} spacing={2}>
          <ListItem>
            <Badge colorScheme="yellow">Not found</Badge>: The variant is not
            found in gnomAD
          </ListItem>
          <ListItem>
            <Badge colorScheme="yellow">High AF</Badge>: The variant has a
            higher allele frequency than the most common ClinVar
            pathogenic/likely pathogenic variant. It is important to establish
            whether this variant is disease-causing. Please use caution when
            including this variant in genetic prevalence estimates.
          </ListItem>
          <ListItem>
            <Badge colorScheme="yellow">Low AN</Badge>: The variant is covered
            in fewer than 50% of individuals in gnomAD. Allele frequency
            estimates may not be reliable.
          </ListItem>
          <ListItem>
            <Badge colorScheme="yellow">Homozygotes</Badge>: The variant has
            homozygotes present in gnomAD. This flag displays the number of
            homozygotes.
          </ListItem>
          <ListItem>
            <Badge colorScheme="yellow">Filtered</Badge>: For this variant, one
            or more samples failed quality control steps in gnomAD. This flag
            displays how many samples were filtered, and for what reason.
          </ListItem>
          <ListItem>
            <Badge colorScheme="yellow">Genomes only</Badge>: The variant is
            found only in gnomAD genome samples.
          </ListItem>
        </UnorderedList>
        <Text mt={4}>
          <strong>Gene</strong>
        </Text>
        <UnorderedList listStyleType="none" mt={4} mb={4}>
          <ListItem>
            <Badge colorScheme="yellow">I</Badge>: The gene is associated with
            multiple inheritance patterns.
          </ListItem>
          <ListItem>
            <Badge colorScheme="yellow">D</Badge>: The gene is associated with
            multiple diseases.
          </ListItem>
        </UnorderedList>
      </Text>
    ),
  },
  {
    title:
      "Why is this calculator not suited for autosomal dominant and x-linked conditions?",
    answer: (
      <Text>
        This method is designed for autosomal recessive disease because
        prevalence can be calculated by observing carriers at expected rates in
        the general population, i.e., using the carrier frequency in unaffected
        individuals. In contrast, for dominant disorders, pathogenic variants
        are typically found in affected individuals who are less likely to
        participate in or meet recruitment criteria for research studies that
        are included in reference population databases. As a result, this method
        does not work as well for many autosomal dominant conditions. For
        X-linked disorders in carrier females, the mild manifestation of disease
        could have similar effects as dominant disorders. We are working on
        creating methods and tools for estimating genetic prevalence of AD and
        XL diseases and hope to add them in future versions. This method is
        designed for autosomal recessive disease. Individuals with rare disease
        are less likely to participate in or meet recruitment criteria for
        research studies that are included in reference population databases, so
        this method does not work for autosomal dominant or X-linked conditions.
        For the same reason, the depletion of symptomatic carriers could lower
        the allele frequencies of pathogenic variants observed in gnomAD. We are
        working on creating methods and tools for estimating genetic prevalence
        of AD and XL diseases and hope to add them in future versions.
      </Text>
    ),
  },
  {
    title: "What version of gnomAD is used in GeniE?",
    answer: (
      <>
        <Text>
          Currently GeniE allows users to select on of two versions of gnomAD:
          v4.1.0 (default) and v2.1.1. While most of the individuals in v2.1.1
          are included in v4.1, there are some key different between the two
          datasets.
        </Text>

        <Text mt={8}>
          <strong>Genome build:</strong>
        </Text>
        <Text mt={4}>
          v4.1.0 is mapped to GRCh38/hg38 and v2.1.1 is mapped to GRCh37/hg19.
        </Text>

        <Text mt={8}>
          <strong>Size:</strong>
        </Text>
        <Text mt={4}>
          The gnomAD v4.1.0 data set is over 5 times the size of previous
          versions of gnomAD, containing 730,947 exomes plus the 76,215 genomes
          previously called in gnomAD v3, all mapped to the GRCh38/hg38
          reference sequence.
        </Text>
        <Text mt={4}>
          The gnomAD v2.1.1 data set contains data from 125,748 exomes and
          15,708 whole genomes, all mapped to the GRCh37/hg19 reference
          sequence. Most of the data from v2 are included in v4.
        </Text>

        <Text mt={8}>
          <strong>Coverage corrections:</strong>
        </Text>
        <Text mt={4}>
          In gnomAD v4.1.0, allele numbers are calculated across all callable
          sites in the gnomAD exomes and genomes. This allows us to combine
          exome and genome allele numbers at all sites with gnomAD variation,
          improving the accuracy of the allele frequency estimtes. In gnomAD
          v2.1.1 this method was not used, meaning that allele frequencies could
          look higher than they truly were. An example of this is if a variant
          was identified in one genome sample in v2, the allele frequency was
          reported as ~1/32,000 (0.00003) despite there being sufficient
          coverage in the exomes to show the variant was absent from the other
          ~220,000 alelles, and thus has a frequency closer to 1/250,000
          (0.000004)
        </Text>

        <Text mt={8}>
          <strong>Genetic ancestry subgroups:</strong>
        </Text>
        <Text mt={4}>
          Genetic ancestry subgroups (ex. Korean, Bulgarian, Estonian) are
          available in v2, but not in v4.
        </Text>
      </>
    ),
  },
  {
    title:
      "Why don’t I see all the genetic ancestry groups in gnomAD in the graphs?",
    answer: (
      <>
        <Text>
          Clinical Genome Resource (ClinGen) Sequence Variant Interpretation
          Working Group has recommended only using allele frequencies when there
          are more than 2,000 reference alleles (
          <ChakraLink
            href="https://pubmed.ncbi.nlm.nih.gov/30311383/"
            isExternal
          >
            PMID: 30311383
          </ChakraLink>
          ). Due to this recommendation we only return results for genetic
          ancestry groups with more than 2,000 reference alleles. For more
          information on the genetic ancestry included in gnomAD and how those
          are determined, plase see the{" "}
          <ChakraLink
            href="https://gnomad.broadinstitute.org/help/ancestry"
            isExternal
          >
            gnomAD FAQ
          </ChakraLink>{" "}
          on genetic ancestry.
        </Text>
      </>
    ),
  },
  {
    title: "Why do I not see all known pathogenic variants in my list?",
    answer: (
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
    ),
  },
  {
    title: "What factors should I consider when interpreting these results?",
    answer: (
      <>
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
            <strong>Symptomatic carriers:</strong> We use gnomAD as our source
            of allele frequencies for GeniE. Individuals with rare disease are
            less likely to participate in or meet recruitment criteria for
            research studies that are included in reference population
            databases. Depletion of symptomatic carriers could lower the allele
            frequencies of pathogenic variants observed in gnomAD.
          </ListItem>
          <ListItem>
            <strong>Impacts to life expectancy:</strong> Genetic prevalence
            represents the estimated proportion of a population that has a
            causal genotype for a genetic disorder, however it does not account
            for the possibility that specific allele combinations may lead to
            early misscarriage or neonatal loss. Some combinations could lead to
            loss of life early on, before the individual could be identified as
            having the clinical diagnosis.
          </ListItem>
          <ListItem>
            <strong>Reduced penetrance and variable expressivity:</strong>{" "}
            Similarly, the full phenotypic spectrum is still being discovered
            for many diseases. This final estimate does not currently take into
            consideration whether everyone with a casual genotype would present
            with the phenotype/disease of interest.
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
            variant is more common in a population that is not well represented
            in gnomAD, the disease-causing variant(s) could appear to be absent
            or rare in the population data. Learn more about the genetic
            ancestry groups in gnomAD{" "}
            <ChakraLink
              href="https://gnomad.broadinstitute.org/stats#diversity"
              isExternal
            >
              here
            </ChakraLink>
          </ListItem>
          <ListItem>
            <em>
              What proportion of affected individuals have disease-causing
              variants detectable by exome or genome sequencing?
            </em>{" "}
            Variants in gnomAD have been identified via exome or genome
            sequencing. Variants not detectable by one for these two
            technologies will not be included in these estimates. Additionally,
            if a significant portion of patients with a clinical diagnosis are
            still missing a molecular diagnosis, that would mean that the full
            variant spectrum is not totally understood and would also lead to a
            lower estimated genetic prevalence.
          </ListItem>
          <ListItem>
            <em>Is the disease-gene relationship still relatively new?</em> It
            can take years to appreciate the full variant spectrums for a novel
            disease. During that time there can be fewer pathogenic variants
            known for a disease, which limits the number of allele frequencies
            included in the calculations. This can lead to lower than expected
            frequency information. One of the benefits of this tool is we will
            enable users to redo the calculations over time including more
            variants as they are collected.
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
            penetrance and variable expressivity can all lead to estimated
            genetic prevalence being considerably higher than estimates based on
            a clinical diagnosis alone. Additionally, does the disease have any
            phenocopies, either caused by another gene that could lead to
            individuals being diagnostically grouped in with some more common,
            non-specific phenotype like autism or cerebral palsy?
          </ListItem>
          <ListItem>
            <em>
              Does the gene, or specific regions of the gene, have lower than
              average allele numbers?
            </em>{" "}
            Allele frequencies are determined by allele count/allele number.
            Having lower allele numbers for a specific variant or region can
            inflate the frequencies. Clinical Genome Resource (ClinGen) Sequence
            Variant Interpretation Working Group has recommended only using
            allele frequencies when there are more than 2,000 reference alleles
            (
            <ChakraLink
              href="https://pubmed.ncbi.nlm.nih.gov/30311383/"
              isExternal
            >
              PMID: 30311383
            </ChakraLink>
            ).
          </ListItem>
        </UnorderedList>
      </>
    ),
  },
  {
    title:
      "What are gnomAD and ClinVar and why do you use these databases for this tool?",
    answer: (
      <>
        <Text mb={2}>
          The{" "}
          <ChakraLink href="https://gnomad.broadinstitute.org/" isExternal>
            Genome Aggregation Database (gnomAD)
          </ChakraLink>{" "}
          is a database of aggregated exome and genome sequencing data
          contributed by a coalition of investigators. This database does not
          include individuals recruited for severe pediatric disease (e.g.,
          cystic fibrosis and autism) as well as their first-degree relatives,
          allowing the database to largely represent the general population,
          making it ideal for our estimates.
        </Text>

        <Text>
          <ChakraLink href="https://www.ncbi.nlm.nih.gov/clinvar/" isExternal>
            ClinVar
          </ChakraLink>{" "}
          is a database of genomic variation and its relationship to human
          health. The variants and clinical significance listed in the database
          come largely from{" "}
          <ChakraLink
            href="https://www.ncbi.nlm.nih.gov/clinvar/docs/submitter_list/"
            isExternal
          >
            clinical genetic testing laboratories
          </ChakraLink>
          . Variant curation (the process used for determining clinical
          significance) guidelines have changed over time, so we do recommend
          reviewing the source data to determine if you feel the variant should
          be included in your calculations.
        </Text>
      </>
    ),
  },
  {
    title:
      "Can GeniE compute genetic prevalence estimates for multiple genes at one time?",
    answer: (
      <Text>
        While you can upload variants from multiple genes using GeniE's custom
        variant list, the model for genetic prevalence will assume digenic
        inheritance, rather than giving you the sum of each of the individual
        genes. We are working towards having functionality that allows you to
        create a meta report for multiple gene estimates, but for now we
        recommend calculating each gene separately and then adding the estimates
        together.
      </Text>
    ),
  },
  {
    title: "What is the difference between each of the roles for sharing?",
    answer: (
      <>
        <Text>
          GeniE users can share their lists with other GeniE users via the
          sharing functionality on the results page. Only owners of a list can
          add additional users. In order to be added as a user to the list, they
          must sign in using a Google authorized account.
        </Text>
        <UnorderedList listStyleType="none" ml={8} mt={4} mb={8}>
          <ListItem>
            <em>Viewer:</em>These users can view the data but not make any
            changes
          </ListItem>
          <ListItem mt={4}>
            <em>Editor:</em>These users will be allowed to make changes to the
            variant list and add private notes, but not will not be able to add
            any users or make a list public
          </ListItem>
          <ListItem mt={4}>
            <em>Owner:</em>These users will have all the capabilities of an
            editor but also have the ability to add other collaborators or
            designate a list to become public. Creators of a list are owners by
            default. There can be multiple owners of a list.
          </ListItem>
        </UnorderedList>
      </>
    ),
  },
  {
    title: "What are public lists?",
    answer: (
      <>
        <Text>
          All new variant lists default to being a private list, only visible to
          the creator and any GeniE users that are given access by an owner.
          Users can choose to make their lists public, which allows any
          individual to have view-only access to their estimates.
        </Text>
        <Text mt={4}>
          Variant list owners can also apply to have their variant list
          represented on GeniE's dashboard. After applying, a staff member must
          approve the list for it to be on the{" "}
          <Link to="/dashboard">Dashboard</Link>.
        </Text>
      </>
    ),
  },
  {
    title: "How to handle reduced penetrance variants?",
    answer: (
      <>
        <Text>
          Some variants can be pathogenic yet have much reduced penetrance
          compared to other variants in the gene. For recessive diseases, these
          are often hypomorphic alleles where they have partial activity. For
          example, some splice variants only lead to partial splice disruption
          and the transcript is still expressed at a reduced level. Others may
          be a missense variant that reduces enzyme activity but still leaves
          the protein largely intact. For many of these variants, they may only
          cause disease if combined with a second allele that is fully
          pathogenic but not when the hypomorphic allele is homozygous.
          Therefore, one may wish to exclude them from the calculation if the
          disease that is manifest is too divergent from the primary disease or
          in order to exclude the effects of the homozygous state. Alternatively
          one can include these alleles and then subtract the homozygous
          frequency of the reduced penetrant allele(s) from the final
          calculation.
        </Text>
      </>
    ),
  },
];

const FAQView = () => {
  const [expandedFAQs, setExpandedFAQs] = useState<number[]>([]);
  const location = useLocation();

  useEffect(() => {
    const scrollToHash = () => {
      const hash = location.hash.slice(1);
      const element = document.getElementById(`accordion-button-${hash}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    };

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const index = faqs.findIndex((faq) => slugTitle(faq.title) === hash);
      if (index !== -1) {
        setExpandedFAQs((prevIndices) =>
          prevIndices.includes(index) ? prevIndices : [...prevIndices, index]
        );
      }
    };

    handleHashChange();
    setTimeout(scrollToHash, 100);
  }, [location]);

  const handleAccordionChange = (indices: number[]) => {
    setExpandedFAQs(indices);
  };

  return (
    <>
      <Text mb={8}>
        Below are commonly asked questions.
        {/* To learn more about GeniE, including
        technical details and browser navigateion, please see our{" "}
        <ChakraLink href="TODO:" isExternal>blog post</ChakraLink>. */}
      </Text>
      <Accordion
        index={expandedFAQs}
        onChange={handleAccordionChange}
        allowMultiple
      >
        {faqs.map((faq) => {
          return <FAQItem title={faq.title}>{faq.answer}</FAQItem>;
        })}
      </Accordion>
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
