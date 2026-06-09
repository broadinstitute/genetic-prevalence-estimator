import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Center,
  Heading,
  HStack,
  Spinner,
  Text,
  useToast,
  Link as ChakraLink,
  UnorderedList,
  ListItem,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { del, get } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, atom, authStore, useStore } from "../../state";
import { GnomadPopulationId } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DateTime from "../DateTime";
import { DescriptionList, DescriptionListItem } from "../DescriptionList";
import DocumentTitle from "../DocumentTitle";
import { printOnly, screenOnly } from "../media";

import VariantListCharts from "../VariantListPage/VariantListCalculations/VariantListCharts";
import VariantListMetadata from "../VariantListPage/VariantListMetadata";
import VariantListStatus from "../VariantListPage/VariantListStatus";

import VariantsTable from "../VariantListPage/VariantsTable";
import { TaggedGroups } from "../VariantListPage/VariantListPage";
import { VariantId } from "../../types";

const RecessiveMethods = () => {
  return (
    <>
      <Text fontWeight="bold">Gene Symbol</Text>
      <Text mb={2}>
        Gene symbols reflect gene information found in gnomAD, which are derived
        from the{" "}
        <ChakraLink href="https://www.genenames.org/" isExternal>
          HUGO Gene Nomenclature Committee (HGNC)
        </ChakraLink>
        . Genes included on the dashboard have a moderate, strong or definitive
        association with a disease based on the{" "}
        <ChakraLink href="https://thegencc.org/" isExternal>
          Gene Curation Coalition (GenCC) database
        </ChakraLink>
        , and have an autosomal dominant, autosomal recessive or semi dominant
        inheritance pattern. Flags next to the gene symbol indicate genes that
        are associated with multiple inheritance patterns (I), multiple diseases
        (D), or are known clonal expansion spermatogonia (C) or clonal
        hematopoiesis of indeterminate potential (H) genes.
      </Text>

      <Text fontWeight="bold">Modes of Inheritance</Text>
      <Text mb={2}>
        The mode(s) of inheritance associated with disease-causing variants in
        each gene (e.g., autosomal recessive (AR), autosomal dominant (AD), or
        semidominant (SD)) are included and derived from GenCC.
      </Text>
      <Text mb={2}>
        Autosomal recessive (AR) = A mode of inheritance for diseases associated
        to a gene located on one of the autosomes, in which a disease presents
        in individuals with two disease-causing alleles, either homozygotes (two
        copies of the same allele) or compound heterozygotes (each copy of a
        gene has a distinct allele).
      </Text>
      <Text mb={2}>
        Autosomal dominant [AD] = A mode of inheritance for diseases related to
        a gene located on one of the autosomes, in which a disease manifests in
        heterozygotes. In other words the disorder is caused when a single copy
        of a disease-causing variant is present.
      </Text>
      <Text mb={2}>
        Semidominant [SD] = A mode of inheritance that is observed for diseases
        related to a gene encoded on chromosomes in which a disease can manifest
        in a monoallelic (e.g. heterozygotes) and biallelic (e.g. homozygotes,
        compound heterozygotes) state. The phenotype can be similar, or vary in
        severity depending on the number of alleles affected.
      </Text>

      <Text fontWeight="bold">
        Aggregate allele frequency for LP/P variants
      </Text>
      <Text mb={2}>
        Aggregate allele frequency for LP/P variants takes a cumulative allele
        frequency of ClinVar pathogenic/likely pathogenic variants and gnomAD
        high confidence predicted loss-of-function variants only. All frequency
        annotations were collected across all the global and sub-continental
        ancestries in gnomAD v4.1.0 with more than 2,000 reference alleles (
        <ChakraLink href="https://pubmed.ncbi.nlm.nih.gov/30311383/" isExternal>
          PMID: 30311383
        </ChakraLink>
        ). However, estimates have not been manually reviewed and may contain
        non-disease causing variants.
      </Text>

      <Text fontWeight="bold">
        Estimated heterozygous frequency (carrier frequency)
      </Text>
      <Text mb={2}>
        Estimated heterozygous frequency is an aggregate of the
        heterozygous/carrier frequency of all variants included in the
        designated variant list. There are four options for calculating carrier
        frequency in GenIE: The aggregate carrier frequency is calculated by
        2*cAF (see aggregate allele frequency for LP/P variants).
      </Text>
      <Text mb={2}>
        GenIE offers multiple methods for calculating carrier frequency,
        allowing users to easily compare and contrast the various methods and
        find the one that works best for their gene/disease of interest. All of
        these methods are based primarily on the Hardy-Weinberg principle (HW).{" "}
        <ChakraLink href="/faq">Learn more</ChakraLink> about the methods for
        calculating carrier frequency and genetic prevalence.
      </Text>

      <Text fontWeight="bold">
        Estimated biallelic frequency (preliminary genetic prevalence)
      </Text>
      <Text mb={2}>
        Preliminary genetic prevalence estimates are algorithmically generated
        using ClinVar pathogenic/likely pathogenic variants and gnomAD high
        confidence predicted loss-of-function variants only. These estimates
        have not been manually reviewed and may contain non-disease causing
        variants. Use with caution.
      </Text>
      <Text mb={2}>
        These results are only available for genes that are associated with
        diseases inherited through an AR or SD mode of inheritance.
      </Text>
      <Text mb={2}>
        Genetic prevalence estimates are based primarily on the Hardy-Weinberg
        equation (HW):
      </Text>
      <Text ml={4} mt={6}>
        <strong>
          P<sup>2</sup> + 2pq + q<sup>2</sup> = 1
        </strong>
      </Text>
      <UnorderedList listStyleType="none" ml={12} mt={4} mb={8}>
        <ListItem>
          p<sup>2</sup> = homozygous reference allele frequency (AA)
        </ListItem>
        <ListItem>2pq = heterozygous variant allele frequency (Aa)</ListItem>
        <ListItem>
          q<sup>2</sup> = homozygous variant allele frequency (aa)
        </ListItem>
      </UnorderedList>
      <Text mb={2}>
        The genetic prevalence (q^2) is calculated by squaring the sum of all
        allele frequencies for variants included in the variant list (q).
      </Text>
      <Text mb={2}>
        <ChakraLink href="/faq">Learn more</ChakraLink> about the methods for
        calculating carrier frequency and genetic prevalence.
      </Text>

      <Text fontWeight="bold">
        Estimated incidence of de novo variation (per 100,000)
      </Text>
      <Text mb={2}>
        Genetic incidence of de novo variation estimates the rate of newly
        arising disease-causing variation entering the population. GIDNV
        combines mutation rate of a gene with an estimate of the proportion of
        missense and loss-of-function (LoF) variants that are expected to be
        disease-causing. It is important to note that this estimate does not
        account for inherited variation.{" "}
        <ChakraLink href="/faq">Learn more</ChakraLink> about the methods for
        calculating GIDNV.
      </Text>

      <Text fontWeight="bold">Contact for public estimate</Text>
      <Text mb={2}>
        For public estimates, a contact may be provided for questions regarding
        how a list was created. Owners of public estimates can edit the list,
        manage collaborators, and delete the list.
      </Text>

      <Text fontWeight="bold">Supporting document</Text>
      <Text mb={2}>
        Attachments from open source publications or patient advocacy group
        documents that explain the method of calculating prevalence, etc. for
        public estimates. Owners can also attach URLS.
      </Text>

      <Text fontWeight="bold">Prevalence orphanet</Text>
      <Text mb={2}>
        Orphanet disease prevalence estimates are imported through their release
        files.
      </Text>

      <Text mb={2}>
        To learn more about the GenIE dashboard see our{" "}
        <ChakraLink href="/faq">FAQ</ChakraLink>.
      </Text>
    </>
  );
};

const deleteDashboardList = (uuid: string): Promise<void> => {
  return del(`/dashboard-lists/${uuid}/`);
};

type DashboardList = any;

type DashboardListPageProps = {
  dashboardListStore: Store<DashboardList>;
  refreshDashboardList: () => void;
};

const toRecord = ({
  seriesData,
  geneticAncestryGroups,
}: {
  seriesData: number[];
  geneticAncestryGroups: GnomadPopulationId[];
}) => {
  const all_genetic_ancestry_groups = ["global", ...geneticAncestryGroups];

  const recordData: { [key: string]: number } = {};

  for (let i = 0; i < all_genetic_ancestry_groups.length; i++) {
    recordData[all_genetic_ancestry_groups[i]] = seriesData[i];
  }

  return recordData;
};

const DashboardListPage = (props: DashboardListPageProps) => {
  const { user } = useStore(authStore);
  const { dashboardListStore, refreshDashboardList } = props;
  const dashboardList = useStore(dashboardListStore);

  const toast = useToast();

  const history = useHistory();

  const [showMethods, setShowMethods] = useState(false);
  const userIsStaff = user?.is_staff ? true : false;

  const blankSet: Set<string> = new Set<string>();

  const blankTaggedGroups: TaggedGroups = {
    A: { displayName: "", variantList: new Set<VariantId>() },
    B: { displayName: "", variantList: new Set<VariantId>() },
    C: { displayName: "", variantList: new Set<VariantId>() },
    D: { displayName: "", variantList: new Set<VariantId>() },
  };

  return (
    <>
      <Box mb={4} sx={printOnly}>
        These estimates were performed using GeniE, the Genetic Prevalence
        Estimator ({document.location.hostname}), created and maintained by the
        Translation Genomics Group and Rare Genomes Project at the Broad
        Institute.
      </Box>

      <Heading as="h1" mb={4}>
        {dashboardList.label}
      </Heading>

      <VariantListStatus
        variantList={dashboardList}
        refreshVariantList={refreshDashboardList}
      />

      {dashboardList.notes && (
        <Text mb={4} maxWidth={"70%"}>
          {`${dashboardList.notes}. This algorithm uses ClinVar pathogenic/likely pathogenic variants and gnomAD high confidence predicted loss-of-function variants only. These estimates have not been manually reviewed and may contain non-disease causing variants. Use with caution.`}
        </Text>
      )}

      <VariantListMetadata variantList={dashboardList} />

      <DescriptionList mb={4}>
        <DescriptionListItem label="Created">
          <DateTime datetime={dashboardList.created_at} />
        </DescriptionListItem>
      </DescriptionList>

      {userIsStaff && (
        <HStack mb={4} sx={screenOnly}>
          <ButtonWithConfirmation
            size="sm"
            colorScheme="red"
            confirmationPrompt="This cannot be undone."
            confirmButtonText="Delete"
            onClick={() => {
              deleteDashboardList(dashboardList.uuid).then(
                () => {
                  history.push("/dashboard/");
                },
                (error) => {
                  toast({
                    title: "Unable to delete dashboard list",
                    description: renderErrorDescription(error),
                    status: "error",
                    duration: 10000,
                    isClosable: true,
                  });
                }
              );
            }}
          >
            Delete
          </ButtonWithConfirmation>
        </HStack>
      )}

      <VariantListCharts
        genetic_ancestry_groups={dashboardList.metadata.populations}
        hasOptionToShowContributionsBySource={false}
        calculations={{
          prevalence: toRecord({
            seriesData: dashboardList.variant_calculations.prevalence,
            geneticAncestryGroups: dashboardList.metadata.populations,
          }),
          prevalenceBayesian: toRecord({
            seriesData: dashboardList.variant_calculations.prevalence_bayesian,
            geneticAncestryGroups: dashboardList.metadata.populations,
          }),
          carrierFrequency: toRecord({
            seriesData: dashboardList.variant_calculations.carrier_frequency,
            geneticAncestryGroups: dashboardList.metadata.populations,
          }),
          carrierFrequencySimplified: toRecord({
            seriesData:
              dashboardList.variant_calculations.carrier_frequency_simplified,
            geneticAncestryGroups: dashboardList.metadata.populations,
          }),
          carrierFrequencyRawNumbers: toRecord({
            seriesData:
              dashboardList.variant_calculations.carrier_frequency_raw_numbers,
            geneticAncestryGroups: dashboardList.metadata.populations,
          }),
        }}
      />

      <Box sx={screenOnly} mb={6}>
        <HStack>
          <Heading as="h2" size="md" mb={2}>
            Top 10 Variants
          </Heading>
        </HStack>

        {/* TODO: add proper abstraction here instead of passing tons of blanks */}
        <VariantsTable
          userCanEdit={false}
          includePopulationFrequencies={[]}
          variantList={{
            ...dashboardList,
            variants: dashboardList.top_ten_variants,
          }}
          searchText={""}
          selectedVariants={blankSet}
          taggedGroups={blankTaggedGroups}
          notIncludedVariants={blankSet}
          shouldShowVariant={() => {
            return true;
          }}
          variantNotes={{}}
          onChangeNotIncludedVariants={() => {}}
          onChangeSelectedVariants={() => {}}
          onChangeTaggedGroups={() => {}}
          onEditVariantNote={() => {}}
          includeNotesColumn={false}
          includeCheckboxColumn={false}
          includeTagColumn={false}
          isTopTen={true}
        />
      </Box>

      <Button sx={screenOnly} onClick={() => setShowMethods((show) => !show)}>
        {`${showMethods ? "Hide" : "View"} methods`}
      </Button>
      <Box
        sx={{
          display: showMethods ? "block" : "none",
          "@media print": {
            display: "block",
          },
        }}
      >
        <Heading as="h2" size="md" mt={4} mb={2}>
          Methods
        </Heading>
        <RecessiveMethods />
      </Box>
    </>
  );
};

const DashboardListPageContainer = (props: { uuid: string }) => {
  const { uuid } = props;

  const dashboardListStoreRef = useRef<Store<DashboardList> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let refreshInterval: number | undefined = undefined;
    let refreshCanceled = false;

    const refreshDashboardList = () => {
      get(`/dashboard-lists/${uuid}/`).then(
        (dashboardList) => {
          if (refreshCanceled) {
            return;
          }

          dashboardListStoreRef.current?.set(dashboardList);

          if (
            !(
              dashboardList.status === "Queued" ||
              dashboardList.status === "Processing"
            )
          ) {
            window.clearInterval(refreshInterval);
          }
        },
        (error) => {
          window.clearInterval(refreshInterval);
          setError(error);
        }
      );
    };

    setIsLoading(true);
    get(`/dashboard-lists/${uuid}/`)
      .then((dashboardList) => {
        dashboardListStoreRef.current = atom(dashboardList);

        if (
          dashboardList.status === "Queued" ||
          dashboardList.status === "Processing"
        ) {
          refreshInterval = window.setInterval(refreshDashboardList, 15000);
        }
      }, setError)
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      window.clearInterval(refreshInterval);
      refreshCanceled = true;
    };
  }, [uuid, refreshKey]);

  if (isLoading) {
    return (
      <>
        <DocumentTitle title="Dashboard list" />
        <Center>
          <Spinner size="lg" />
        </Center>
      </>
    );
  }

  if (error) {
    return (
      <>
        <DocumentTitle title="Dashboard list" />

        <Box mb={2}>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink as={RRLink} to="/">
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink as={RRLink} to="/dashboard/">
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>
        </Box>
        <Heading as="h1" mb={4}>
          Error
        </Heading>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Unable to load dashboard list</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </>
    );
  }

  if (dashboardListStoreRef.current) {
    const dashboardListStore = dashboardListStoreRef.current;
    const dashboardList = dashboardListStore.get();
    return (
      <>
        <DocumentTitle title={dashboardList.label} />

        <Box mb={2} sx={screenOnly}>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink as={RRLink} to="/">
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink as={RRLink} to="/dashboard/">
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbItem isCurrentPage>
              <span>{dashboardList.label}</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </Box>
        <DashboardListPage
          dashboardListStore={dashboardListStore}
          refreshDashboardList={() => setRefreshKey((k) => k + 1)}
        />
      </>
    );
  }

  return null;
};

export default DashboardListPageContainer;
