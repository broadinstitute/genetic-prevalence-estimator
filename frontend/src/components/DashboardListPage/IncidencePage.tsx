import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
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

import DominantListCharts from "./DominantListCharts";

const deletedominantDashboardList = (uuid: string): Promise<void> => {
  return del(`/dashboard-lists/${uuid}/`);
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
