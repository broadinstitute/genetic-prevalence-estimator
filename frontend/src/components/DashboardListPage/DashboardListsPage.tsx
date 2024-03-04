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

import { del, get } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, atom, authStore, useStore } from "../../state";
import { VariantList } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DocumentTitle from "../DocumentTitle";

type DashboardList = {
  uuid: string;
  label: string;
  metadata: {
    gnomad_version: string;
    reference_genome: string;
    gene_symbol: string;
  };
  public_variant_list?: VariantList;
};

const DashboardLists = (props: {
  dashboardListsStore: Store<DashboardList[]>;
}) => {
  const dashboardLists = useStore(props.dashboardListsStore);
  const toast = useToast();
  const { user } = useStore(authStore);

  const deleteDashboardList = (
    dashboardListToDelete: DashboardList
  ): Promise<void> => {
    return del(`/dashboard-lists/${dashboardListToDelete.uuid}/`).then(
      () => {
        props.dashboardListsStore.set(
          dashboardLists.filter(
            (otherDashboardList) =>
              otherDashboardList.uuid !== dashboardListToDelete.uuid
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
      <Table variant="striped">
        <Thead>
          <Tr>
            <Th>Gene</Th>
            <Th>Label (dashboard)</Th>
            <Th>Label (public)</Th>
            <Th>Contact</Th>
          </Tr>
        </Thead>
        <Tbody>
          {dashboardLists.map((dashboardList: DashboardList) => {
            return (
              <Tr key={dashboardList.uuid}>
                <Td>{dashboardList.metadata.gene_symbol}</Td>
                <Td>
                  <Link
                    as={RRLink}
                    to={`/dashboard-lists/${dashboardList.uuid}`}
                  >
                    {dashboardList.label}
                  </Link>
                </Td>
                {dashboardList.public_variant_list && (
                  <>
                    <Td>
                      <Link
                        as={RRLink}
                        to={`/variant-lists/${dashboardList.public_variant_list.uuid}`}
                      >
                        {dashboardList.public_variant_list.label}
                      </Link>
                    </Td>
                    <Td>
                      {dashboardList.public_variant_list.access_permissions
                        ?.filter((ap) => ap.level === "Owner")
                        .map((ap) => ap.user)}
                    </Td>
                  </>
                )}
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
