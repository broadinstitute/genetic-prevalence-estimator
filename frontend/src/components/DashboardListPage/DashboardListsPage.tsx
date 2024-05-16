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
  Input,
  Link,
  Table,
  Thead,
  Tbody,
  Spinner,
  Tr,
  Th,
  Td,
  useToast,
} from "@chakra-ui/react";

import { useEffect, useRef, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { del, get, postFile } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, atom, authStore, useStore } from "../../state";
import { VariantList } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DocumentTitle from "../DocumentTitle";

import { renderFrequencyFraction } from "../VariantListPage/VariantListCalculations/calculationsDisplayFormats";

type DashboardList = {
  gene_id: string;
  gene_symbol: string;
  label: string;
  metadata: {
    gnomad_version: string;
    reference_genome: string;
    gene_symbol: string;
  };
  estimates: {
    genetic_prevalence: number[];
  };
  genetic_prevalence_orphanet: string;
  genetic_prevalence_genereviews: string;
  genetic_prevalence_other: string;
  genetic_incidence_orphanet: string;
  representative_variant_list?: VariantList & {
    estimates: {
      genetic_prevalence: {
        global: number;
      };
      carrier_frequency: {
        global: number;
      };
    };
  };
};

const DashboardLists = (props: {
  dashboardListsStore: Store<DashboardList[]>;
}) => {
  const dashboardLists = useStore(props.dashboardListsStore);
  const toast = useToast();
  const { user } = useStore(authStore);
  const userIsStaff = user?.is_staff ? true : false;

  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (event: any) => {
    setFile(event.target.files[0]);
  };

  const loadDashboardLists = (): Promise<void> => {
    if (!file) {
      toast({
        title: "You need to add a file",
        status: "error",
        duration: 10_000,
        isClosable: true,
      });
      return new Promise<void>((resolve, reject) => resolve());
    }

    const formData = new FormData();
    const blob = new Blob([file!], { type: file!.type });
    formData.append("csv_file", blob, file!.name);

    return postFile(`/dashboard-lists/load`, formData).then(
      () => {
        toast({
          title: "Dashboard lists loaded!",
          status: "success",
          duration: 30_000,
          isClosable: true,
        });
        setFile(null);
      },
      (error) => {
        toast({
          title: "Unable to load dashboard lists",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      }
    );
  };

  const deleteDashboardList = (
    dashboardListToDelete: DashboardList
  ): Promise<void> => {
    return del(`/dashboard-lists/${dashboardListToDelete.gene_id}/`).then(
      () => {
        props.dashboardListsStore.set(
          dashboardLists.filter(
            (otherDashboardList) =>
              otherDashboardList.gene_id !== dashboardListToDelete.gene_id
          )
        );
        toast({
          title: "Dashboard list deleted",
          status: "success",
          duration: 30_000,
          isClosable: true,
        });
      },
      (error) => {
        toast({
          title: "Unable to delete dashboard list",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      }
    );
  };

  return (
    <>
      {userIsStaff && (
        <>
          <Input
            type="file"
            onChange={handleFileChange}
            placeholder="Add a file populate lists"
            size="md"
            sx={{
              "::file-selector-button": {
                height: 10,
                padding: 0,
                mr: 4,
                background: "none",
                border: "none",
                fontWeight: "bold",
              },
            }}
          />

          <ButtonWithConfirmation
            size="sm"
            colorScheme="blue"
            confirmationPrompt="This cannot be undone."
            confirmButtonText="Re-load"
            onClick={() => {
              loadDashboardLists();
            }}
          >
            Load
          </ButtonWithConfirmation>
        </>
      )}

      <Table variant="striped">
        <Thead>
          <Tr>
            <Th>Gene</Th>
            <Th>ClinVar LP/P and gnomAD LoF</Th>
            <Th>Estimates available on GeniE</Th>
            <Th>Contact for public estimate</Th>
            <Th>Supporting documents</Th>
            <Th>Additional resources</Th>
            <Th>Prevalence orphanet</Th>
            {/* TODO: Until any of these have values, leave them blank */}
            {/* <Th>Prevalence GeneReviews</Th> */}
            {/* <Th>Prevalence other</Th> */}
            {/* <Th>Incidence other</Th> */}
          </Tr>
        </Thead>
        <Tbody>
          {dashboardLists.map((dashboardList: DashboardList) => {
            return (
              <Tr key={dashboardList.gene_symbol}>
                <Td>{dashboardList.gene_symbol}</Td>
                <Td>
                  <Link
                    as={RRLink}
                    to={`/dashboard-lists/${dashboardList.gene_id}`}
                  >
                    {renderFrequencyFraction(
                      dashboardList.estimates.genetic_prevalence[0]
                    )}
                  </Link>
                </Td>

                {dashboardList.representative_variant_list && (
                  <>
                    <Td>
                      <Link
                        as={RRLink}
                        to={`/variant-lists/${dashboardList.representative_variant_list.uuid}`}
                      >
                        {renderFrequencyFraction(
                          dashboardList.representative_variant_list.estimates
                            .genetic_prevalence.global
                        )}
                      </Link>
                    </Td>
                    <Td>
                      {dashboardList.representative_variant_list.access_permissions
                        ?.filter((ap) => ap.level === "Owner")
                        .map((ap) => ap.user)}
                    </Td>
                    <Td>todo-replist</Td>
                    <Td>todo-replist</Td>
                  </>
                )}

                {!dashboardList.representative_variant_list && (
                  <>
                    <Td></Td>
                    <Td></Td>
                    <Td></Td>
                    <Td></Td>
                  </>
                )}
                <Td>
                  <Link
                    href={`https://www.orpha.net/en/disease`}
                    isExternal
                    target="_blank"
                  >
                    {dashboardList.genetic_prevalence_orphanet}
                  </Link>
                </Td>
                {/* TODO: Until any of these have values, hide them */}
                {/* <Td>{dashboardList.genetic_prevalence_genereviews}</Td> */}
                {/* <Td>{dashboardList.genetic_prevalence_other}</Td> */}
                {/* <Td>{dashboardList.genetic_incidence_orphanet}</Td> */}
                {user?.is_staff && (
                  <Td>
                    <ButtonWithConfirmation
                      size="sm"
                      colorScheme="red"
                      confirmationPrompt="This cannot be undone."
                      confirmButtonText="Delete"
                      onClick={() => {
                        deleteDashboardList(dashboardList);
                      }}
                    >
                      Delete
                    </ButtonWithConfirmation>
                  </Td>
                )}
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </>
  );
};

const DashboardListContainer = () => {
  const dashboardListStoreRef = useRef<Store<DashboardList[]>>(
    atom<DashboardList[]>([])
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    get("/dashboard-lists/")
      .then((dashboardLists) => {
        dashboardListStoreRef.current.set(dashboardLists);
      }, setError)
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <Center>
        <Spinner size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>Unable to load dashboard list</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return <DashboardLists dashboardListsStore={dashboardListStoreRef.current} />;
};

const DashboardListsPage = () => {
  return (
    <>
      <DocumentTitle title="Dashboard Lists" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>Dashboard lists</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Dashboard lists
      </Heading>

      <DashboardListContainer />
    </>
  );
};

export default DashboardListsPage;
