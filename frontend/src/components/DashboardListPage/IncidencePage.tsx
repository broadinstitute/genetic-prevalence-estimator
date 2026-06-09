import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Link as BaseLink,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Center,
  Heading,
  HStack,
  Spinner,
  Text,
  useToast,
  Button,
  UnorderedList,
  ListItem,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { del, get } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, atom, authStore, useStore } from "../../state";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DateTime from "../DateTime";
import { DescriptionList, DescriptionListItem } from "../DescriptionList";
import DocumentTitle from "../DocumentTitle";
import { printOnly, screenOnly } from "../media";

import VariantListMetadata from "../VariantListPage/VariantListMetadata";
import VariantListStatus from "../VariantListPage/VariantListStatus";
import {
  CES_GENE_SYMBOLS,
  CHIP_GENE_SYMBOLS,
} from "./AllDashboardListsSummaryPage";

import DominantListCharts from "./DominantListCharts";

const deletedominantDashboardList = (uuid: string): Promise<void> => {
  return del(`/dashboard-lists/${uuid}/`);
};

const DominantIncidenceMethods = () => {
  return (
    <>
      <Text mb={2}>
        Genetic incidence of{" "}
        <Text as="span" fontStyle="italic">
          de novo
        </Text>{" "}
        variation (GIDNV) estimates the rate of new disease-causing variation
        entering the population. To do this, we first identify how many expected
        de novo variants there are in a given gene (mutation rate), and then
        estimate the proportion of these variants that are expected to be
        disease-causing. This is done for both missense and loss-of-function
        (LoF) variants, summed together, and then multiplied by two to account
        for both chromosomes.
      </Text>

      <Text mb={2}>This is represented by the formula:</Text>

      <Text ml={8} mt={8}>
        <strong>
          GIDNV = ( ( ( oe_mis_prior - os_mis ) * mu_mis ) + ( ( oe_lof_prior -
          oe_lof ) * mu_lof ) ) * 2
        </strong>
      </Text>
      <UnorderedList listStyleType="none" ml={12} mt={4} mb={8}>
        <ListItem>
          <Text as="span" fontWeight="bold">
            mu - mutation rate
          </Text>
          : Represents how often a new mutation should appear in a new
          generation. For this analysis we used the gnomAD-generated per gene
          mutation rate.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="bold">
            oe - observed/expected
          </Text>
          : A continuous measure of how tolerant a gene is to a certain class of
          variation (e.g. loss-of-function (LoF), missense (mis)). Observed (o)
          is the number of variants, for each variant class, identified in
          gnomAD for each gene. This is then divided by the expected (e) number
          of variants, which is calculated via a statistical model. For example,
          and oe_mis of 0.3 would mean that 30% of the expected number of
          missense variants were observed in this gene.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="bold">
            oe_prior - oe prior
          </Text>
          : Represents the average oe for non-disease causing genes, excluding
          olfactory genes, which we know are highly mutable.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="bold">
            oe_mis_prior - oe missense prior
          </Text>
          : Average missense oe for all non-disease associated and non-olfactory
          genes in gnomAD. (v4.1.1 oe_mis_prior = 0.906)
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="bold">
            oe_mis - oe of missense variation
          </Text>
          : Represents the observed / expected number of missense variants in a
          gene.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="bold">
            mu_mis - missense mutation rate
          </Text>
          : The expected number of new missense mutations in a generation in a
          gene.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="bold">
            oe_lof_prior - oe LoF prior
          </Text>
          : Average LoF oe for all non-disease associated and non-olfactory
          genes in gnomAD. (v4.1.1 oe_LoF_prior = 0.675)
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
          : The expected number of new loss of function variants in a generation
          in a gene.
        </ListItem>
      </UnorderedList>

      <Text mb={2}>
        In more detail, the number of expected{" "}
        <Text as="span" fontStyle="italic">
          de novo
        </Text>{" "}
        variations per gene is indicated by the mutation rate, mu, calculated in
        gnomAD v4.1.1<sup>1</sup>The proportion of these expected de novo
        variants that are disease causing is estimated using the scaling factor
        oe<sub>prior</sub>-oe<sub>mis</sub>. This is equivalent to the depletion
        of the observed / expected (oe) from the non-disease gene average, where
        oe represents how conserved a gene is for having variants in a given
        variant class. If oe_mis_prior {"<"} oe_mis, the adjusted mutation rate
        would be negative. As this is not biologically meaningful, a mutation
        rate of zero is assigned since we assume that means there are no
        disease-causing variants in the gene. The same holds for oe_lof_prior{" "}
        {"<"} oe_lof.Given there are two copies of each chromosome, the ultimate
        value is multiplied by 2.
      </Text>

      <Text mb={2}>
        To learn more about this method and GenIE<sup>2</sup> see our{" "}
        <ChakraLink href="/faq">FAQ</ChakraLink>
      </Text>

      <Heading as="h3" size="md" mt={4} mb={2}>
        References
      </Heading>
      <UnorderedList>
        <ListItem>
          Guez J, Goodrich JK, Moldovan MA, et al. Integrating 730,947 exome
          sequences with clinical literature improves gene discovery. medRxiv.
          Published online March 25, 2026. doi:10.64898/2026.03.23.26349081
        </ListItem>

        <ListItem>
          Baxter SM, Singer-Berk M, Glaze C, et al. The power of partnership:
          Democratizing genetic prevalence to empower patient advocacy. medRxiv.
          Published online March 31, 2026. doi:10.64898/2026.03.30.26349539
        </ListItem>
      </UnorderedList>
    </>
  );
};

type dominantDashboardList = any;

type IncidencePageProps = {
  dominantDashboardListStore: Store<dominantDashboardList>;
  refreshdominantDashboardList: () => void;
};

const IncidencePage = (props: IncidencePageProps) => {
  const { user } = useStore(authStore);
  const { dominantDashboardListStore, refreshdominantDashboardList } = props;
  const dominantDashboardList = useStore(dominantDashboardListStore);
  const toast = useToast();

  const [showMethods, setShowMethods] = useState(false);

  const history = useHistory();
  const userIsStaff = user?.is_staff ? true : false;

  return (
    <>
      <Box mb={4} sx={printOnly}>
        These estimates were performed using GeniE, the Genetic Prevalence
        Estimator ({document.location.hostname}), created and maintained by the
        Translation Genomics Group and Rare Genomes Project at the Broad
        Institute.
      </Box>

      <Heading as="h1" mb={4}>
        Incidence Details for {dominantDashboardList.metadata.gene_symbol}
      </Heading>

      <VariantListStatus
        variantList={dominantDashboardList}
        refreshVariantList={refreshdominantDashboardList}
      />

      {dominantDashboardList.notes && (
        <Text mb={4} maxWidth={"70%"}>
          {`${dominantDashboardList.notes}. This algorithm uses ClinVar pathogenic/likely pathogenic variants and gnomAD high confidence predicted loss-of-function variants only. These estimates have not been manually reviewed and may contain non-disease causing variants. Use with caution.`}
        </Text>
      )}

      <VariantListMetadata variantList={dominantDashboardList} />

      <DescriptionList mb={4}>
        <DescriptionListItem label="Created">
          <DateTime datetime={dominantDashboardList.date_created} />
        </DescriptionListItem>
      </DescriptionList>

      {CHIP_GENE_SYMBOLS.indexOf(dominantDashboardList.metadata.gene_symbol) !==
        -1 && (
        <Box mb={4}>
          <Alert status="error">
            <AlertIcon />
            <span>
              This is a known clonal expansion spermatogonia (CES) gene (
              <BaseLink
                href="https://pubmed.ncbi.nlm.nih.gov/41062699/"
                isExternal
              >
                Seplyarskiy et al.
              </BaseLink>
              ). These genes are associated with cell proliferation, which may
              impact the accuracy of these results
            </span>
          </Alert>
        </Box>
      )}

      {CES_GENE_SYMBOLS.indexOf(dominantDashboardList.metadata.gene_symbol) !==
        -1 && (
        <Box mb={4}>
          <Alert status="error">
            <AlertIcon />
            <span>
              This is a known clonal hematopoiesis of indeterminate potential
              (CHIP) gene (
              <BaseLink
                href="https://pubmed.ncbi.nlm.nih.gov/25426837/"
                isExternal
              >
                Jaiswa et al.
              </BaseLink>
              ,
              <BaseLink
                href="https://pubmed.ncbi.nlm.nih.gov/34663986/"
                isExternal
              >
                Niroula et al.
              </BaseLink>
              ). These genes are associated with clonal hematopoiesis, which may
              lead to these results overestimating the incidence of{" "}
              <Text as="span" fontStyle="italic">
                de novo
              </Text>{" "}
              variation
            </span>
          </Alert>
        </Box>
      )}

      {userIsStaff && (
        <HStack mb={4} sx={screenOnly}>
          <ButtonWithConfirmation
            size="sm"
            colorScheme="red"
            confirmationPrompt="This cannot be undone."
            confirmButtonText="Delete"
            onClick={() => {
              deletedominantDashboardList(dominantDashboardList.uuid).then(
                () => {
                  history.push("/dashboard-incidence/");
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
      <DominantListCharts
        calculations={dominantDashboardList.de_novo_variant_calculations}
        gene_symbol={dominantDashboardList.metadata.gene_symbol}
      />

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
        <DominantIncidenceMethods />
      </Box>
    </>
  );
};

const IncidencePageContainer = (props: { uuid: string }) => {
  const { uuid } = props;

  const dominantDashboardListStoreRef = useRef<Store<dominantDashboardList> | null>(
    null
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let refreshInterval: number | undefined = undefined;
    let refreshCanceled = false;

    const refreshdominantDashboardList = () => {
      get(`/dashboard-incidence/${uuid}/`).then(
        (dominantDashboardList) => {
          if (refreshCanceled) {
            return;
          }

          dominantDashboardListStoreRef.current?.set(dominantDashboardList);

          if (
            !(
              dominantDashboardList.status === "Queued" ||
              dominantDashboardList.status === "Processing"
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
    get(`/dashboard-incidence/${uuid}/`)
      .then((dominantDashboardList) => {
        dominantDashboardListStoreRef.current = atom(dominantDashboardList);

        if (
          dominantDashboardList.status === "Queued" ||
          dominantDashboardList.status === "Processing"
        ) {
          refreshInterval = window.setInterval(
            refreshdominantDashboardList,
            15000
          );
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
        <DocumentTitle title="Incidence Details" />
        <Center>
          <Spinner size="lg" />
        </Center>
      </>
    );
  }

  if (error) {
    return (
      <>
        <DocumentTitle title="Incidence Details" />

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
          <AlertTitle>Unable to load incidence details page</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </>
    );
  }

  if (dominantDashboardListStoreRef.current) {
    const dominantDashboardListStore = dominantDashboardListStoreRef.current;
    const dominantDashboardList = dominantDashboardListStore.get();
    return (
      <>
        <DocumentTitle title={dominantDashboardList.label} />

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
              <span>Incidence</span>
            </BreadcrumbItem>
          </Breadcrumb>
        </Box>
        <IncidencePage
          dominantDashboardListStore={dominantDashboardListStore}
          refreshdominantDashboardList={() => setRefreshKey((k) => k + 1)}
        />
      </>
    );
  }
  return null;
};

export default IncidencePageContainer;
