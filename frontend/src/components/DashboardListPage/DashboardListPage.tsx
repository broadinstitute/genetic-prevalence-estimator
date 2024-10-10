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

import Methods from "../VariantListPage/Methods";
import VariantListCharts from "../VariantListPage/VariantListCalculations/VariantListCharts";
import VariantListMetadata from "../VariantListPage/VariantListMetadata";
import VariantListStatus from "../VariantListPage/VariantListStatus";

import VariantsTable from "../VariantListPage/VariantsTable";
import { TaggedGroups } from "../VariantListPage/VariantListPage";
import { VariantId } from "../../types";

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
    A: new Set<VariantId>(),
    B: new Set<VariantId>(),
    C: new Set<VariantId>(),
    D: new Set<VariantId>(),
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
          selectedVariants={blankSet}
          taggedGroups={blankTaggedGroups}
          shouldShowVariant={() => {
            return true;
          }}
          variantNotes={{}}
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
        <Methods variantList={dashboardList} />
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
