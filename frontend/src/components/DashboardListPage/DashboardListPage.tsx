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

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DateTime from "../DateTime";
import { DescriptionList, DescriptionListItem } from "../DescriptionList";
import DocumentTitle from "../DocumentTitle";
import { printOnly, screenOnly } from "../media";

import Methods from "../VariantListPage/Methods";
import VariantListCalculations from "../VariantListPage/VariantListCalculations/VariantListCalculations";
import VariantListMetadata from "../VariantListPage/VariantListMetadata";
import VariantListStatus from "../VariantListPage/VariantListStatus";

const deleteDashboardList = (uuid: string): Promise<void> => {
  return del(`/dashboard-lists/${uuid}/`);
};

type DashboardList = any;

type DashboardListPageProps = {
  dashboardListStore: Store<DashboardList>;
  refreshDashboardList: () => void;
};

const DashboardListPage = (props: DashboardListPageProps) => {
  const { user } = useStore(authStore);
  const { dashboardListStore, refreshDashboardList } = props;
  const dashboardList = useStore(dashboardListStore);

  const toast = useToast();

  const history = useHistory();

  const [showMethods, setShowMethods] = useState(false);
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
        {dashboardList.label}
      </Heading>

      <VariantListStatus
        variantList={dashboardList}
        refreshVariantList={refreshDashboardList}
      />

      {dashboardList.notes && <Text mb={4}>{dashboardList.notes}</Text>}

      <VariantListMetadata variantList={dashboardList} />

      <DescriptionList mb={4}>
        <DescriptionListItem label="Created">
          <DateTime datetime={dashboardList.created_at} />
        </DescriptionListItem>
        <DescriptionListItem label="Last updated">
          <DateTime datetime={dashboardList.updated_at} />
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
                  history.push("/dashboard-lists/");
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

      {dashboardList.status === "Ready" && (
        <VariantListCalculations
          variantList={dashboardList}
          variants={dashboardList.variants}
        />
      )}

      <Box sx={screenOnly}>
        <HStack>
          <Heading as="h2" size="md" mb={2}>
            Variants
          </Heading>
        </HStack>

        {/* <VariantListVariants
          annotationType={annotationType}
          selectedVariants={selectedVariants}
          selectionDisabled={loadingAnnotation}
          variantList={dashboardList}
          variantNotes={variantNotes}
          userCanEdit={userCanEdit}
          userIsStaff={userIsStaff}
          onChangeAnnotationType={setAnnotationType}
          onChangeSelectedVariants={setSelectedVariants}
          onEditVariantNote={setVariantNote}
        /> */}
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

      {/* <Modal
        isOpen={isAddVariantsModalOpen}
        size="xl"
        onClose={onCloseAddingVariantModal}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add variants</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Alert status="warning" alignItems="flex-start" mb={2}>
              <AlertIcon />
              <AlertDescription>
                Adding variants will update the clinical significance column for
                all variants in this variant list using the latest ClinVar data.
                <br />
                <br />
                If you would like to save the current clinical significance
                data, download the variant list before adding variants.
              </AlertDescription>
            </Alert>
            <VariantsInput
              id="added-variants"
              value={addedVariants}
              onChange={setAddedVariants}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              mr={3}
              disabled={addingVariants}
              onClick={onCloseAddingVariantModal}
            >
              Cancel
            </Button>
            <Button
              disabled={addingVariants}
              onClick={() => {
                setAddingVariants(true);
                addVariantsToVariantList(
                  dashboardList.uuid,
                  addedVariants.map((variant) => variant.id)
                )
                  .then(
                    () => {
                      refreshVariantList();
                    },
                    (error) => {
                      toast({
                        title: "Unable to add variants",
                        description: renderErrorDescription(error),
                        status: "error",
                        duration: 10000,
                        isClosable: true,
                      });
                    }
                  )
                  .finally(() => {
                    setAddingVariants(false);
                  });
              }}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal> */}
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
              <BreadcrumbLink as={RRLink} to="/dashboard-lists/">
                Dashboard Lists
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
              <BreadcrumbLink as={RRLink} to="/dashboard-lists/">
                Dashboard Lists
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
