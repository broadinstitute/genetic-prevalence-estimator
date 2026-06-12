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
  OrderedList,
} from "@chakra-ui/react";
import { Link as RRLink } from "react-router-dom";
import Link from "./Link";

import DocumentTitle from "./DocumentTitle";

const slugTitle = (title: string) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "-")
    .trim();
};

const DeNovo = () => {
  return (
    <Text as="span" fontStyle="italic">
      de novo
    </Text>
  );
};

interface FaqQuestion {
  title: string;
  content?: React.ReactNode;
  subItems?: FaqQuestion[];
}

const faqs: FaqQuestion[] = [
  {
    title: "General",
    subItems: [
      {
        title: "Why do I need to log in?",
        content: (
          <Text>
            In order to store your variant lists and allow you to edit them over
            time, we need to have you logged into a Google account. By having
            users log in, we are also able to allow for sharing of lists across
            users, enabling collaboration.
          </Text>
        ),
      },
      {
        title: "How do you pronounce GenIE?",
        content: <Text>Jee · nee</Text>,
      },
      {
        title:
          "What are gnomAD and ClinVar and why do you use these databases for this tool?",
        content: (
          <>
            <Text mb={2}>
              The{" "}
              <ChakraLink href="https://gnomad.broadinstitute.org/" isExternal>
                Genome Aggregation Database (gnomAD)
              </ChakraLink>{" "}
              is a database of aggregated exome and genome sequencing data
              contributed by a coalition of investigators. This database does
              not include individuals recruited for severe pediatric disease
              (e.g., cystic fibrosis) as well as their first-degree relatives,
              allowing the database to largely represent the general population,
              making it ideal for our estimates.
            </Text>

            <Text>
              <ChakraLink
                href="https://www.ncbi.nlm.nih.gov/clinvar/"
                isExternal
              >
                ClinVar
              </ChakraLink>{" "}
              is a database of genomic variation and its relationship to human
              health. The variants and clinical significance listed in the
              database come largely from{" "}
              <ChakraLink
                href="https://www.ncbi.nlm.nih.gov/clinvar/docs/submitter_list/"
                isExternal
              >
                clinical genetic testing laboratories
              </ChakraLink>
              . Variant curation (the process used for determining clinical
              significance of a variant) guidelines have changed over time, so
              we do recommend reviewing the source data to determine if you feel
              the variant should be included in your calculations.
            </Text>
          </>
        ),
      },
      {
        title:
          "Does GenIE support liftover of gnomAD IDs between v2 (GRCh37) and v4 (GRCh38)?",
        content: (
          <>
            <Text>
              GenIE does not lift over coordinates in the gnomAD style IDs
              between different reference genomes. This can be accomplished
              using the{" "}
              <ChakraLink href="https://genebe.net/tools/liftover" isExternal>
                GeneBe liftover tool
              </ChakraLink>
              .
            </Text>
          </>
        ),
      },
    ],
  },
  {
    title: "Genetic Prevalence",
    subItems: [
      {
        title: "Why do you call this an Estimated Genetic Prevalence?",
        content: (
          <>
            <Text mb={2}>
              <strong>Prevalence</strong> is the proportion of a population that
              has a specific characteristic in a given time period. Example: "1
              in 10 Americans has Type 2 diabetes."
            </Text>
            <Text mb={2}>
              <strong>Incidence</strong> is the measure of the number of new
              cases with a specific characteristic or disease in a population
              over a specified time period. Example: "Every year, 1 in every 600
              women is diagnosed with breast cancer"
            </Text>
            <Text>
              Due to these definitions, we believe that the calculations
              performed by this tool are most accurately defined as an{" "}
              <strong>estimated genetic prevalence</strong>, as they represent
              the estimated proportion of a population that will have a causal
              genotype for a genetic disorder, irrespective of penetrance, age
              of onset, and other factors affecting the disease prevalence.
              These results should always be interpreted in the context of the
              disease/gene of interest. To learn more about considerations for
              these results please see our FAQ “What factors should I consider
              when interpreting these genetic prevalence results?”, in the
              section "Genetic Prevalence". To read more about how these
              estimates relate to prevalence, incidence and lifetime risk please
              read{" "}
              <ChakraLink
                href="https://gnomad.broadinstitute.org/news/2026-06-genie-incidence"
                isExternal
              >
                our recent blog post.
              </ChakraLink>
            </Text>
          </>
        ),
      },

      {
        title:
          "Is the Estimated Genetic Prevalence the same as disease prevalence?",
        content: (
          <Text>
            No. Genetic prevalence correlates but does not equate to disease
            prevalence (
            <ChakraLink
              href="https://pubmed.ncbi.nlm.nih.gov/34078906/"
              isExternal
            >
              PMID: 34078906
            </ChakraLink>
            ). Genetic prevalence refers to the proportion of a population that
            has a causal genotype for a specific genetic disorder, irrespective
            of whether these individuals will or will not manifest the disease.
            For instance, if the causative genotype is not fully penetrant, then
            the estimated genetic prevalence will be higher than actual disease
            prevalence. To learn more about the factors that shape the estimated
            genetic prevalence, please read the FAQ question "What factors
            should I consider when interpreting these genetic prevalence
            results?" in the section "Genetic Prevalence".
          </Text>
        ),
      },
      {
        title:
          "What method does GenIE use to calculate carrier frequency and genetic prevalence?",
        content: (
          <>
            <Text>
              GenIE offers multiple methods for calculating carrier frequency
              and genetic prevalence, allowing users to easily compare and
              constrast the various methods and find the one that works best for
              their gene/disease of interest. All of these methods are based
              primarily on the{" "}
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
              For the purposes of genetic prevalence, <i>q</i> equals the sum of
              the allele frequencies (AF) for all variants included in the
              designated variant list (note: variants can be excluded from the
              sum by unchecking the box next to the variant name). There are
              four options for calculating carrier frequency in GenIE:
            </Text>
            <Text mt={4}>
              <i>Full (2pq):</i> This method takes into account the aggregate
              allele frequency of p, which is equal to 1-q.
            </Text>
            <Text mt={4}>
              <i>Simplified (2q):</i> In rare disease, p is so close to 1 that
              it can be excluded from the formula. This model is often used in
              rare disease to simplify the math.
            </Text>
            <Text mt={4}>
              <i>Remove gnomAD homozygotes:</i> This version of the formula will
              subtract the homozygous counts for any variant in the list that
              has homozygotes in gnomAD before performing the calculations via
              the formula:{" "}
              <Text ml={8} mt={8}>
                AC - 2 * (# of homozygotes)
              </Text>
              <Text ml={8} mt={4} mb={8}>
                AC = allele count of a particular variant
              </Text>
              This approach might be taken if there is concern that homozygous
              variants seen in the general population as represented by gnomAD
              may not be pathogenic. For some recessive conditions, there are
              hypomorphic or mild variants that can cause disease when in trans
              with a more severe variant but do not cause disease in the
              homozygous state.
            </Text>
            <Text mt={4}>
              <i>Raw numbers:</i> This option shows you the sum total of the
              allele counts for all variants included over the average allele
              number (AN) for all variants included within that ancestry group.
              Note: the AN can vary for each variant due to differences in
              coverage across regions of a gene and/or limitations of exomes.{" "}
            </Text>

            <Text mt={8}>
              <strong>Genetic prevalence methods:</strong>
            </Text>
            <Text mt={4}>
              <i>
                Simplified (q<sup>2</sup>):
              </i>
              This method calculates prevalence by squaring the sum of all AFs
              for variants included in the variant list (q).
            </Text>
            <Text mt={4}>
              <i>Bayesian method:</i> This model assumes linkage equilibrium
              across the variants, which can make a slight difference in the
              estimates for more common recessive diseases. The formula (below)
              used for this method is based on Schrodi et al. 2015 (
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
                p<sub>i</sub> = the frequency of the "i"th pathogenic variant in
                the population studied, assuming linkage equilibrium across the
                variants. This converges to (1 - &sum;<sub>i=1</sub>
                <sup>k</sup>(1 - p<sub>i</sub>))<sup>2</sup> as the frequencies
                go to 0.
              </Text>
            </Text>

            <Text>
              <strong>Display options</strong>:
            </Text>

            <Text mt={4}>
              For both carrier frequency and genetic prevalence the user is
              given a variety of options for displaying the results, including
              fraction and scientific notation. For genetic prevalence, we also
              provide the option to see the results as "per 100,000" which is a
              common metric in epidemiology.
            </Text>

            <Text mt={4}>
              Users can also compare the results by source (gnomAD vs ClinVar),
              and choose whether or not to include sub genetic ancestry group
              estimates (gnomAD v2.1.1 only)
            </Text>
          </>
        ),
      },
      {
        title: "What types of variants does GenIE support?",
        content: (
          <Text>
            GenIE supports gnomAD single nucleotide variants (SNVs), small
            insertions and deletions (indels), and structural variants (SVs).
          </Text>
        ),
      },
      {
        title: "How do I add structural variants to a variant list?",
        content: (
          <>
            <Text>
              Currently, structural variants (SVs) can only be added via
              creation of a manual list, or by adding the variant manually after
              a recommended list is created. For more info, see the FAQ question
              "How do I add or remove variants after a variant list is
              created?", in the section "Genetic Prevalence".
            </Text>

            <Text mt={4}>
              Please note: for gnomAD v2 SVs there are fewer genetic ancestry
              groups for both the non-Finnish european and Finnish ancestry
              groups are included in the "European" ancestry group. For the
              purposes of display in GenIE, we have included the v2 SV
              "European" genetic ancestry group in the "European (non-Finnish)"
              group.
            </Text>
          </>
        ),
      },
      {
        title:
          "What are the flags in the variant table on the genetic prevalence page",
        content: (
          <Text>
            GenIE provides flags to bring attention to certain aspects of
            variants in variant list, or genes on the dashboard. The possible
            flags are:
            <Text mt={4}>
              <strong>Variant</strong>
            </Text>
            <UnorderedList listStyleType="none" mt={4} mb={4} spacing={2}>
              <ListItem>
                <Badge colorScheme="yellow">Not found</Badge>: The variant is
                not found in gnomAD
              </ListItem>
              <ListItem>
                <Badge colorScheme="yellow">High AF</Badge>: The variant has a
                higher allele frequency than the most common ClinVar
                pathogenic/likely pathogenic variant. It is important to
                establish whether this variant is disease-causing. Please use
                caution when including this variant in genetic prevalence
                estimates.
              </ListItem>
              <ListItem>
                <Badge colorScheme="yellow">Low AN</Badge>: The variant is
                covered in fewer than 50% of individuals in gnomAD. Allele
                frequency estimates may not be reliable.
              </ListItem>
              <ListItem>
                <Badge colorScheme="yellow">Homozygotes</Badge>: The variant has
                homozygotes present in gnomAD. This flag displays the number of
                homozygotes.
              </ListItem>
              <ListItem>
                <Badge colorScheme="yellow">Filtered</Badge>: For this variant,
                one or more samples failed quality control steps in gnomAD. This
                flag displays how many samples were filtered, and for what
                reason.
              </ListItem>
              <ListItem>
                <Badge colorScheme="yellow">Genomes only</Badge>: The variant is
                found only in gnomAD genome samples.
              </ListItem>
            </UnorderedList>
          </Text>
        ),
      },
      {
        title:
          "How do I add or remove variants after a variant list is created?",
        content: (
          <Text>
            To add more variants to a list after a variant list is created,
            select the '+' button next to the "Variants" header. At this time,
            variants cannot be completely removed from the list after it is
            created, but can be excluded from the calculations by unchecking the
            box next to the gnomAD ID in the variant table.
          </Text>
        ),
      },
      {
        title:
          "Does the genetic prevalence calculator work for autosomal dominant and x-linked conditions?",
        content: (
          <>
            <Text>
              This method is primarily designed for autosomal recessive disease
              because prevalence can be calculated by observing heterozygotes at
              expected rates in the general population, i.e., using the carrier
              frequency in unaffected individuals. For dominant disorders,
              pathogenic variants are typically found in affected individuals
              who are less likely to participate in or meet recruitment criteria
              for research studies that are included in reference population
              databases such as gnomAD. However for later onset and more mild
              conditions heterozygote rates can provide an estimated prevalence
              of affected/at risk individuals.
            </Text>
            <Text>
              While some past studies have attempted to use this method for
              X-linked recessive conditions, it can lead to underestimates. This
              is likely due to two factors: 1) the method does not account for
              the variable contributions of de novo pathogenic variants across
              X-linked conditions, and 2) we see a depletion of female carriers
              for X-linked conditions in gnomAD, likely due to females with
              milder symptoms of X-linked condition being less likely to
              participate in research studies included in gnomAD. More work is
              needed to improve the quality of genetic prevalence estimates for
              all inherited conditions.
            </Text>
          </>
        ),
      },

      {
        title: "What version of gnomAD is used in GenIE for genetic prevalence",
        content: (
          <>
            <Text>
              Currently GenIE allows users to select one of two versions of
              gnomAD: v4.1.1 (default) and v2.1.1. While most of the individuals
              in v2.1.1 are included in v4.1.1, there are some key differences
              between the two datasets.
            </Text>

            <Text mt={8}>
              <strong>Genome build:</strong>
            </Text>
            <Text mt={4}>
              v4.1.1 is mapped to GRCh38/hg38 and v2.1.1 is mapped to
              GRCh37/hg19.
            </Text>

            <Text mt={8}>
              <strong>Size:</strong>
            </Text>
            <Text mt={4}>
              The gnomAD v4.1.1 dataset is over 5 times the size of previous
              versions of gnomAD, containing 730,947 exomes plus the 76,215
              genomes previously called in gnomAD v3.1.2, all mapped to the
              GRCh38/hg38 reference sequence.
            </Text>
            <Text mt={4}>
              The gnomAD v2.1.1 dataset contains data from 125,748 exomes and
              15,708 whole genomes, all mapped to the GRCh37/hg19 reference
              sequence. Most of the data from v2 are included in v4.
            </Text>

            <Text mt={8}>
              <strong>UK Biobank:</strong>
            </Text>
            <Text mt={4}>
              The gnomAD v4.1.1 callset includes 416,555 UK Biobank and 314,392
              non-UK Biobank exomes.
            </Text>

            <Text mt={8}>
              <strong>Coverage corrections:</strong>
            </Text>
            <Text mt={4}>
              In gnomAD v4.1.1, allele numbers are calculated across all
              callable sites in the gnomAD exomes and genomes. This allows us to
              combine exome and genome allele numbers at all sites with gnomAD
              variation, improving the accuracy of the allele frequency
              estimtes. In gnomAD v2.1.1 this method was not used, meaning that
              allele frequencies could look higher than they truly were. An
              example of this is if a variant was identified in one genome
              sample in v2, the allele frequency was reported as ~1/32,000
              (0.00003) despite there being sufficient coverage in the exomes to
              show the variant was absent from the other ~220,000 alelles, and
              thus has a frequency closer to 1/250,000 (0.000004)
            </Text>

            <Text mt={8}>
              <strong>Subpopulations:</strong>
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
        content: (
          <>
            <Text>
              Clinical Genome Resource (ClinGen) Sequence Variant Interpretation
              Working Group has recommended only using allele frequencies when
              there are more than 2,000 reference alleles (
              <ChakraLink
                href="https://pubmed.ncbi.nlm.nih.gov/30311383/"
                isExternal
              >
                PMID: 30311383
              </ChakraLink>
              ). Due to this recommendation we only return results for genetic
              ancestry groups with more than 2,000 reference alleles. For more
              information on the genetic ancestry included in gnomAD and how
              those are determined, please see the{" "}
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
        content: (
          <Text>
            Since we use gnomAD as our reference database for allele frequencies
            we can only include variants that have been seen in 1 or more
            individuals in gnomAD. If a variant is absent from gnomAD, it will
            not be listed in your report, but that doesn’t mean that the variant
            is not pathogenic. It means that the variant is either low
            frequency, it is not well covered by exome and/or genome sequencing,
            or is present in a population not well represented in gnomAD. The
            variant could be in future versions of gnomAD, which is why we
            recommend reassessing these frequencies after new gnomAD releases.
          </Text>
        ),
      },
      {
        title:
          "What factors should I consider when interpreting genetic prevalence results?",
        content: (
          <>
            <Text mb={2}>
              This tool provides an <em>estimated</em> carrier frequency and
              genetic prevalence. There are many factors that go into these
              estimates, which can influence the way you interpret the results.
            </Text>

            <Text mb={2}>
              Disease spectrum is an important part of interpreting genetic
              prevalence. The following factors should always be considered:
            </Text>
            <UnorderedList spacing={2} mb={2}>
              <ListItem>
                <strong>Symptomatic carriers:</strong> We use gnomAD as our
                source of allele frequencies for GenIE. Individuals with rare
                disease are less likely to participate in or meet recruitment
                criteria for research studies that are included in reference
                population databases. Depletion of symptomatic carriers could
                lower the allele frequencies of pathogenic variants observed in
                gnomAD.
              </ListItem>
              <ListItem>
                <strong>Impacts to life expectancy:</strong> Genetic prevalence
                represents the estimated proportion of a population that has a
                causal genotype for a genetic disorder, however it does not
                account for the possibility that specific allele combinations
                may lead to early misscarriage or neonatal loss. Some
                combinations could lead to loss of life early on, before the
                individual could be identified as having the clinical diagnosis.
              </ListItem>
              <ListItem>
                <strong>Reduced penetrance and variable expressivity:</strong>{" "}
                Similarly, the full phenotypic spectrum is still being
                discovered for many diseases. This final estimate does not
                currently take into consideration whether everyone with a casual
                genotype would present with the phenotype/disease of interest.
              </ListItem>
            </UnorderedList>

            <Text mb={2}>
              While genetic prevalence is an important part of answering, “How
              many people are there with X disease?”, additional methods of
              estimating incidence, prevalence, and lifetime risk should also be
              assessed when available. If these various methods are returning
              vastly different results some additional questions should be asked
              about the genetic prevalence estimates.
            </Text>

            <Text mb={2}>
              If you feel the estimate is too low (either globally or a specific
              population):
            </Text>
            <UnorderedList spacing={2} mb={2}>
              <ListItem>
                <Text fontStyle="italic" mb={1}>
                  Is the disease known to be more common in a population not
                  well represented in gnomAD (e.g. Middle Eastern)?
                </Text>{" "}
                Representation can have a big influence on these calculations.
                If a variant is more common in a population that is not well
                represented in gnomAD, the disease-causing variant(s) could
                appear to be absent or rare in the population data. Learn more
                about the genetic ancestry groups in gnomAD{" "}
                <ChakraLink
                  href="https://gnomad.broadinstitute.org/stats#diversity"
                  isExternal
                >
                  here
                </ChakraLink>
                .
              </ListItem>
              <ListItem>
                <Text fontStyle="italic" mb={1}>
                  What proportion of affected individuals have disease-causing
                  variants detectable by exome or genome sequencing?
                </Text>{" "}
                Variants in gnomAD have been identified via exome or genome
                sequencing. Variants not detectable by one for these two
                technologies will not be included in these estimates.
                Additionally, if a significant portion of patients with a
                clinical diagnosis are still missing a molecular diagnosis, that
                would mean that the full variant spectrum is not totally
                understood and would also lead to a lower estimated genetic
                prevalence.
              </ListItem>
              <ListItem>
                <Text fontStyle="italic" mb={1}>
                  Is the disease-gene relationship still relatively new?
                </Text>{" "}
                It can take years to appreciate the full variant spectrums for a
                novel disease. During that time there can be fewer pathogenic
                variants known for a disease, which limits the number of allele
                frequencies included in the calculations. This can lead to lower
                than expected frequency information. One of the benefits of this
                tool is we will enable users to redo the calculations over time
                including more variants as they are collected.
              </ListItem>
            </UnorderedList>

            <Text mb={2}>
              If you feel the estimate is too high (either globally or a
              specific genetic ancestry group):
            </Text>
            <UnorderedList spacing={2} mb={2}>
              <ListItem>
                <Text fontStyle="italic" mb={1}>
                  Are there any high frequency variants in your list that have
                  questionable or unknown significance?
                </Text>{" "}
                Even a single high frequency allele can dramatically impact the
                results so we recommend reviewing any high frequency variants to
                determine if they have a well established association with
                disease. You can unselect a variant to review the results
                without that allele included.
              </ListItem>
              <ListItem>
                <Text fontStyle="italic mb={1}">
                  Do we know the full phenotypic spectrum of the gene?
                </Text>{" "}
                As mentioned above, disease spectrum should always be considered
                in interpreting these results. Impacts to life expectancy,
                reduced penetrance and variable expressivity can all lead to
                estimated genetic prevalence being considerably higher than
                estimates based on a clinical diagnosis alone. Additionally,
                does the disease have any phenocopies caused by another gene
                that could lead to individuals being diagnostically grouped in
                with some more common, non-specific phenotype like autism or
                cerebral palsy?
              </ListItem>
              <ListItem>
                <Text fontStyle="italic" mb={1}>
                  Does the gene, or specific regions of the gene, have lower
                  than average allele numbers?
                </Text>{" "}
                Allele frequencies are determined by allele count/allele number.
                Having lower allele numbers for a specific variant or region can
                inflate the frequencies. Clinical Genome Resource (ClinGen)
                Sequence Variant Interpretation Working Group has recommended
                only using allele frequencies when there are more than 2,000
                reference alleles (
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
          "Can GenIE compute genetic prevalence estimates for multiple genes at one time?",
        content: (
          <Text>
            While you can upload variants from multiple genes using GenIE's
            custom variant list, the model for genetic prevalence will assume
            digenic inheritance, rather than giving you the sum of each of the
            individual genes. We are working towards having functionality that
            allows you to create a meta report for multiple gene estimates, but
            for now we recommend calculating each gene separately and then
            adding the estimates together.
          </Text>
        ),
      },

      {
        title: "What is the difference between each of the roles for sharing?",
        content: (
          <>
            <Text>
              GenIE users can share their lists with other GenIE users via the
              sharing functionality on the results page. Only owners of a list
              can add additional users. In order to be added as a user to the
              list, they must sign in using a Google authorized account.
            </Text>
            <UnorderedList listStyleType="none" ml={8} mt={4} mb={8}>
              <ListItem>
                <em>Viewer:</em> These users can view the data but not make any
                changes
              </ListItem>
              <ListItem mt={4}>
                <em>Editor:</em> These users will be allowed to make changes to
                the variant list and add private notes, but not will not be able
                to add any users or make a list public
              </ListItem>
              <ListItem mt={4}>
                <em>Owner:</em> These users will have all the capabilities of an
                editor but also have the ability to add other collaborators or
                designate a list to become public. Creators of a list are owners
                by default. There can be multiple owners of a list.
              </ListItem>
            </UnorderedList>
          </>
        ),
      },

      {
        title: "How should I handle reduced penetrance variants?",
        content: (
          <>
            <Text>
              Some variants can be pathogenic yet have much reduced penetrance
              compared to other variants in the gene. For recessive diseases,
              these are often hypomorphic alleles where they have partial
              activity. For example, some splice variants only lead to partial
              splice disruption and the transcript is still expressed at a
              reduced level. Others may be a missense variant that reduces
              enzyme activity but still leaves the protein largely intact. For
              many of these variants, they may only cause disease if combined
              with a second allele that is fully pathogenic but not when the
              hypomorphic allele is homozygous. Therefore, one may wish to
              exclude them from the calculation if the disease that is manifest
              is too divergent from the primary disease or in order to exclude
              the effects of the homozygous state. Alternatively one can include
              these alleles and then subtract the homozygous frequency of the
              reduced penetrant allele(s) from the final calculation.
            </Text>
          </>
        ),
      },
    ],
  },
  {
    title: "Genetic Incidence",
    subItems: [
      {
        title: "What is genetic incidence?",
        content: (
          <>
            <Text>
              Genetic incidence is the estimated rate of causal genotypes for a
              disease at zygote formation. Genetic incidence represents the
              number of new cases arising from genetic variation entering a
              population through either inherited or <DeNovo /> variation.
            </Text>
          </>
        ),
      },
      {
        title: "What is the genetic incidence of de novo variation (GIDNV)",
        content: (
          <>
            <Text>
              Genetic incidence of <DeNovo /> variation estimates the rate of
              newly arising disease-causing variation entering the population.
              GIDNV combines mutation rate of a gene with an estimate of the
              proportion of missense and loss-of-function (LoF) variants that
              are expected to be disease-causing. It is important to note that
              this estimate does not account for inherited variation.{" "}
              <ChakraLink
                href="https://gnomad.broadinstitute.org/news/2026-06-genie-incidence"
                isExternal
              >
                Learn more about the methods for calculating GIDNV
              </ChakraLink>
              .
            </Text>
          </>
        ),
      },
      {
        title: "Is the GIDNV the same as disease incidence?",
        content: (
          <>
            <Text mb={2}>
              No. GIDNV only takes into account <DeNovo /> genetic variation.
              This estimate does not include contributions of inherited
              variation. When determining the incidence of a disease, both
              inherited and de novo variation should be taken into
              consideration.
            </Text>

            <Text mb={2}>
              Additionally, GIDNV may include variants into the estimate that
              are embryonically lethal/not compatible with life, and therefore
              not actually seen in individuals with disease. Not all expected
              disease-causing variants will actually cause disease due to
              impacts to life expectancy, variable expressivity, and reduced
              penetrance. See “What factors should I consider when interpreting
              these results?” in the "Genetic Prevalence" section for more
              information.
            </Text>
          </>
        ),
      },
      {
        title: "What method is used to calculate GIDNV",
        content: (
          <>
            <Text mb={2}>
              Genetic incidence of <DeNovo /> variation (GIDNV) estimates the
              rate of new disease-causing variation entering the population. To
              do this, we first identify how many expected de novo variants
              there are in a given gene (mutation rate), and then estimate the
              proportion of these variants that are expected to be
              disease-causing. This is done for both missense and
              loss-of-function (LoF) variants, summed together, and then
              multiplied by two to account for both chromosomes.
            </Text>

            <Text mb={2}>This is represented by the formula:</Text>

            <Text ml={8} mt={8}>
              <strong>
                GIDNV = ( ( ( oe_mis_prior - os_mis ) * mu_mis ) + ( (
                oe_lof_prior - oe_lof ) * mu_lof ) ) * 2
              </strong>
            </Text>
            <UnorderedList listStyleType="none" ml={12} mt={4} mb={8}>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  mu - mutation rate
                </Text>
                : Represents how often a new mutation should appear in a new
                generation. For this analysis we used the gnomAD-generated per
                gene mutation rate.
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  oe - observed/expected
                </Text>
                : A continuous measure of how tolerant a gene is to a certain
                class of variation (e.g. loss-of-function (LoF), missense
                (mis)). Observed (o) is the number of variants, for each variant
                class, identified in gnomAD for each gene. This is then divided
                by the expected (e) number of variants, which is calculated via
                a statistical model. For example, and oe_mis of 0.3 would mean
                that 30% of the expected number of missense variants were
                observed in this gene.
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  oe_prior - oe prior
                </Text>
                : Represents the average oe for non-disease causing genes,
                excluding olfactory genes, which we know are highly mutable.
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  oe_mis_prior - oe missense prior
                </Text>
                : Average missense oe for all non-disease associated and
                non-olfactory genes in gnomAD. (v4.1.1 oe_mis_prior = 0.906)
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  oe_mis - oe of missense variation
                </Text>
                : Represents the observed / expected number of missense variants
                in a gene.
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  mu_mis - missense mutation rate
                </Text>
                : The expected number of new missense mutations in a generation
                in a gene.
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  oe_lof_prior - oe LoF prior
                </Text>
                : Average LoF oe for all non-disease associated and
                non-olfactory genes in gnomAD. (v4.1.1 oe_LoF_prior = 0.675)
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  oe_lof - oe of LoF variation
                </Text>
                : Represents the observed / expected number of loss of function
                variants in a gene.
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="bold">
                  mu_lof - LoF mutation rate
                </Text>
                : The expected number of new loss of function variants in a
                generation in a gene.
              </ListItem>
            </UnorderedList>
          </>
        ),
      },
      {
        title: "What is gnomAD contraint data?",
        content: (
          <>
            <Text mb={2}>
              Genetic constraint is a measure of how much a certain genomic
              region (ex. a gene) is under negative selection. Negative
              selection is the process through which natural selection removes
              disease-causing variations from a population. Knowing how much a
              gene is constrained (e.g., intolerant to pathogenic variation) can
              help prioritize variants that are more likely to have a
              deleterious functional impact.{" "}
              <ChakraLink
                href="https://gnomad.broadinstitute.org/help/constraint"
                isExternal
              >
                Learn more about constraints, including how it is calculated
              </ChakraLink>
              .
            </Text>
          </>
        ),
      },
      {
        title: "What types of variants does GIDNV include?",
        content: (
          <>
            <Text mb={2}>
              GIDNV estimates the rate of expected disease-causing missense and
              loss-of-function variants only. Structural variants (SVs) are not
              included in these estimates.
            </Text>
          </>
        ),
      },
      {
        title:
          "What factors should I consider when interpreting these genetic incidence results?",
        content: (
          <>
            <OrderedList>
              <ListItem>
                <Text textDecoration="underline">
                  Contribution of inherited vs <DeNovo /> variation
                </Text>
                <Text>
                  All Mendelian conditions have a different contribution from
                  inherited vs <DeNovo /> variation. When trying to determine
                  the incidence or prevalence of a disease, both sources of
                  variation need to be taken into consideration. Frequency of
                  heterozygous pathogenic variants in the population should be
                  included in incidence or prevalence estimates.
                </Text>
              </ListItem>
              <ListItem>
                <Text textDecoration="underline">Mechanism of disease</Text>
                <Text>
                  Genetic variants cause disease by different protein-level
                  mechanisms. These include loss-of-function (LoF),
                  gain-of-function (GoF), and dominant negative mechanisms. Some
                  genes only cause disease through either a LoF or GoF
                  mechanism. There are also location-specific considerations
                  such as missense variants clustering in disease “hotspots” and
                  functionally important sites. Understanding the mechanism of
                  disease for a particular gene is important when interpreting
                  these results.
                </Text>
              </ListItem>
              <ListItem>
                <Text textDecoration="underline">Variant type</Text>
                <Text>
                  GIDNV includes combined data from missense and LoF variants.
                  Some diseases may be caused by only pathogenic missense or
                  pathogenic LoF variants. In these cases, specific estimates
                  should be used instead of the combined estimates.
                  Additionally, if disease is caused by variant types other than
                  de novo missense and LoF (e.g., repeat expansions), those
                  sources of variation are not currently included in these
                  estimates.
                </Text>
              </ListItem>
              <ListItem>
                <Text textDecoration="underline">
                  Impacts to life expectancy
                </Text>
                <Text>
                  Although the methods account for some of the de novo variation
                  that is incompatible with life and therefore not present in
                  the population, seeing a higher GIDNV than expected based on
                  other disease frequency metrics may be due to inclusion of
                  some de novo variation that results in embryonic or neonatal
                  lethality.
                </Text>
              </ListItem>
              <ListItem>
                <Text textDecoration="underline">
                  Reduced penetrance and variable expressivity
                </Text>
                <Text>
                  The full phenotypic spectrum is still being discovered for
                  many diseases. The GIDNV estimate does not currently account
                  for reduced penetrance and variable expressivity. As a result,
                  estimates for diseases with reduced penetrance may be higher
                  than clinically based prevalence and incidence estimates.
                  Additionally, this method may include <DeNovo /> variants
                  associated with phenotypic presentations that differ from
                  currently recognized disease manifestations.
                </Text>
              </ListItem>
            </OrderedList>
          </>
        ),
      },
      {
        title: "What are the limitations of this method?",
        content: (
          <>
            <OrderedList mb={2}>
              <ListItem>
                <Text>
                  It does not account for disease caused by inherited variation
                </Text>
              </ListItem>
              <ListItem>
                <Text>
                  May include <DeNovo /> variation that is not disease-causing
                </Text>
              </ListItem>
              <ListItem>
                <Text>
                  May include <DeNovo /> variation that is incompatible with
                  life
                </Text>
              </ListItem>
              <ListItem>
                <Text>
                  Gene-level estimates may be inaccurate when disease
                  manifestation depends on specific protein-level mechanisms
                  such as localized variant hotspots
                </Text>
              </ListItem>
              <ListItem>
                <Text>
                  Gene-level estimates may be inaccurate when disease is driven
                  by specific variant types of non-missense/LoF mechanisms not
                  included in the model
                </Text>
              </ListItem>
              <ListItem>
                <Text>
                  Does not account for incomplete penetrance or variable
                  expressivity
                </Text>
              </ListItem>
            </OrderedList>
          </>
        ),
      },
      {
        title: "What version of gnomAD is used for GIDNV?",
        content: (
          <>
            <Text mb={2}>
              GIDNV uses gnomAD v4.1.1, which is mapped to GRCh38/hg38
            </Text>
          </>
        ),
      },
      {
        title: "Can GIDNV be computed for multiple genes at one time?",
        content: (
          <>
            <Text mb={2}>
              The GIDNV estimates we provide on GenIE are per gene estimates.
              However, there is a download available for all autosomal genes on
              the <ChakraLink href="/dashboard">dashboard page</ChakraLink>.
              Those GIDNV estimates can be combined together for a multi-gene
              estimate.
            </Text>
          </>
        ),
      },
      {
        title:
          "Where can I access GIDNV results for genes not on the GenIE dashboard?",
        content: (
          <>
            <Text mb={2}>
              All autosomal genes with available gnomAD data are listed in the
              "all autosomal genes" download on the{" "}
              <ChakraLink href="/dashboard">dashboard page</ChakraLink> below
              the gene table. The all autosomal gene download includes genes
              that do not have a moderate, strong, or definitive association
              with a disease based on the Gene Curation Coalition (GenCC)
              database.
            </Text>
          </>
        ),
      },
      {
        title: "What are the possible flags in GIDNV?",
        content: (
          <>
            <UnorderedList listStyleType="none" mb={2} spacing={2}>
              <ListItem>
                CHIP (Clonal hematopoiesis of indeterminate potential): CHIP is
                an age-related acquisition of variation that leads to
                genetically distinct, clonally expanded hematopoietic stem cells
                in an individual with hematologic malignancy.
              </ListItem>
              <ListItem>
                CES (Clonal expansion spermatogonia): CES occurs when variation
                in sperm stem cells provides a survival or reproduction
                advantage.
              </ListItem>
            </UnorderedList>
            <Text>
              Both CHIP and CES genes provide a competitive growth advantage by
              playing a role in cell proliferation and could impact the accuracy
              of GIDNV results.
            </Text>
          </>
        ),
      },
    ],
  },
  {
    title: "Dashboard",
    subItems: [
      {
        title: "Why don't I see my gene of interest on the GenIE dashboard?",
        content: (
          <>
            <Text mb={2}>
              Genes included on the dashboard have a moderate, strong or
              definitive association with a disease based on the Gene Curation
              Coalition (GenCC) database, and have an autosomal dominant,
              autosomal recessive or semi dominant inheritance pattern. All
              other genes, with available gnomAD data, are listed in the “all
              autosomal genes” download on the dashboard page. Gene symbols
              reflect gene information found in{" "}
              <ChakraLink href="https://gnomad.broadinstitute.org/" isExternal>
                gnomAD
              </ChakraLink>
              , which are derived from the{" "}
              <ChakraLink href="https://www.genenames.org/" isExternal>
                HUGO Gene Nomenclature Committee
              </ChakraLink>{" "}
              (HGNC).
            </Text>
            <Text mb={2}>
              If your gene of interest is not on the dashboard or the all
              autosomal genes file it is possible that is not the HGNC gene
              name. While GenIE does not support searching by aliases, the
              gnomAD browser does. If you search your gene name in gnomAD and it
              goes to a gene page with a different name, that is the HGNC gene
              name, and you should use that for your search.
            </Text>
          </>
        ),
      },
      {
        title: "What is the aggregate allele frequency for LP/P variants?",
        content: (
          <>
            <Text mb={2}>
              “Aggregate allele frequency for LP/P variants” is generated by
              calculating the cumulative allele frequency of ClinVar
              pathogenic/likely pathogenic variants and gnomAD high confidence
              predicted loss-of-function variants only. All frequency
              annotations were collected across all the global and
              sub-continental ancestries in gnomAD v4.1.1 with more than 2,000
              reference alleles (PMID: 30311383). However, estimates have not
              been manually reviewed and may contain non-disease causing
              variants.
            </Text>
          </>
        ),
      },
      {
        title:
          "Why do you not provide genetic prevalence for autosomal dominant conditions?",
        content: (
          <>
            <Text mb={2}>
              The method used on GenIE for calculating genetic prevalence
              assumes there are two variants present in the individual. As such
              it is currently only applicable for diseases with an AR or SD mode
              of inheritance. Learn more about how we calculate genetic
              prevalence in the FAQ entry: "What method does GenIE use to
              calculate carrier frequency and genetic prevalence?" in the
              "Genetic Prevalence" section.
            </Text>
          </>
        ),
      },
      {
        title: "What are sharable and representative lists?",
        content: (
          <>
            <Text mb={2}>
              All new variant lists default to being a private list, only
              visible to the creator and any GenIE users that are given access
              by an owner. Users can choose to make their lists sharable, which
              allows all users view only access to the variant list, provided
              they know the URL.
            </Text>
            <Text mb={2}>
              Variant list owners can also apply to have their variant list
              represented on GenIE's dashboard. All representative lists are
              reviewed by GenIE staff before being approved for distribution on
              the GenIE dashboard. All approved GenIE public estimates are
              listed <Link to="/dashboard">on the GenIE Dashboard</Link>.
            </Text>
          </>
        ),
      },
    ],
  },
];

const FAQView = () => {
  return (
    <>
      <Text mb={8}>
        Below are commonly asked questions.
        {/* To learn more about GenIE, including
        technical details and browser navigateion, please see our{" "}
        <ChakraLink href="TODO:" isExternal>blog post</ChakraLink>. */}
      </Text>

      <Accordion allowMultiple>
        {faqs.map((parentItem) => {
          const parentSlug = slugTitle(parentItem.title);

          return (
            <AccordionItem key={parentSlug} id={parentSlug}>
              <h2>
                <AccordionButton id={parentSlug}>
                  <Box
                    as="span"
                    flex="1"
                    textAlign="left"
                    fontSize="lg"
                    fontWeight="bold"
                  >
                    {parentItem.title}
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>

              <AccordionPanel pb={4}>
                {parentItem.subItems && parentItem.subItems.length > 0 ? (
                  <Accordion allowMultiple>
                    {parentItem.subItems.map((childItem) => {
                      const childSlug = slugTitle(childItem.title);

                      return (
                        <AccordionItem key={childSlug} border="none">
                          <h2>
                            <AccordionButton id={childSlug}>
                              <Box
                                as="span"
                                flex="1"
                                textAlign="left"
                                fontWeight="bold"
                              >
                                {childItem.title}
                              </Box>
                              <AccordionIcon />
                            </AccordionButton>
                          </h2>
                          <AccordionPanel pb={4}>
                            {childItem.content}
                          </AccordionPanel>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                ) : (
                  parentItem.content
                )}
              </AccordionPanel>
            </AccordionItem>
          );
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
