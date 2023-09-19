import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Center,
  Heading,
  Link,
  Table,
  Thead,
  Tbody,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spinner,
  Tr,
  Th,
  Td,
  useToast,
} from "@chakra-ui/react";

import { useEffect, useRef, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get, patch } from "../api";
import { renderErrorDescription } from "../errors";
import { Store, atom, authStore, useStore } from "../state";
import { VariantListReviewStatusCode } from "../types";

import ButtonWithConfirmation from "./ButtonWithConfirmation";
import DocumentTitle from "./DocumentTitle";

interface PublicVariantList {
  uuid: string;
  label: string;
  metadata: {
    gene_symbol: string;
    gnomad_version: string;
  };
  updated_at: string;
  public_status_updated_by: string;
  public_status: VariantListReviewStatusCode | "";
}

const PublicVariantLists = (props: {
  publicVariantListsStore: Store<PublicVariantList[]>;
}) => {
  const publicVariantLists = useStore(props.publicVariantListsStore);
  const toast = useToast();
  const { user } = useStore(authStore);

  const updatePublicVariantList = (
    publicVariantListToUpdate: PublicVariantList,
    update: { public_status: VariantListReviewStatusCode | "" }
  ): Promise<PublicVariantList> => {
    return patch(
      `/public-variant-lists/${publicVariantListToUpdate.uuid}/`,
      update
    ).then(
      (updatedPublicVariantList) => {
        props.publicVariantListsStore.set(
          publicVariantLists.map((otherPublicVariantList) => {
            return otherPublicVariantList.uuid === updatedPublicVariantList.uuid
              ? updatedPublicVariantList
              : otherPublicVariantList;
          })
        );
        toast({
          title: "Public variant list updated",
          status: "success",
          duration: 30_000,
          isClosable: true,
        });
        return updatedPublicVariantList;
      },
      (error) => {
        toast({
          title: "Unable to update public variant list",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      }
    );
  };

  const deletePublicVariantList = (
    publicVariantListToDelete: PublicVariantList
  ): Promise<void> => {
    return patch(`/public-variant-lists/${publicVariantListToDelete.uuid}/`, {
      public_status: "",
    }).then(
      () => {
        props.publicVariantListsStore.set(
          publicVariantLists.filter(
            (otherPublicVariantList) =>
              otherPublicVariantList.uuid !== publicVariantListToDelete.uuid
          )
        );
        toast({
          title: "Public variant list deleted",
          status: "success",
          duration: 30_000,
          isClosable: true,
        });
      },
      (error) => {
        toast({
          title: "Unable to delete public variant list",
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
            <Th>Label</Th>
            {!user?.is_staff && <Th>gnomAD version</Th>}
            {user?.is_staff && <Th>Updated by</Th>}
            {user?.is_staff && <Th>Approval status</Th>}
            {user?.is_staff && <Th>Remove list</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {publicVariantLists.map((publicList: PublicVariantList) => {
            return (
              <Tr key={publicList.uuid}>
                <Td>{publicList.metadata.gene_symbol}</Td>
                <Td>
                  <Link as={RRLink} to={`/variant-lists/${publicList.uuid}`}>
                    {publicList.label}
                  </Link>
                </Td>
                {!user?.is_staff && (
                  <Td>{publicList.metadata.gnomad_version}</Td>
                )}
                {user?.is_staff && (
                  <Td>{publicList.public_status_updated_by}</Td>
                )}
                {user?.is_staff && (
                  <Td>
                    <Menu>
                      <MenuButton
                        as={Button}
                        size="sm"
                        rightIcon={<ChevronDownIcon />}
                      >
                        {publicList.public_status.toString()}
                      </MenuButton>
                      <MenuList>
                        <MenuItem
                          onClick={() => {
                            updatePublicVariantList(publicList, {
                              public_status:
                                VariantListReviewStatusCode.APPROVED,
                            });
                          }}
                        >
                          Approve
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            updatePublicVariantList(publicList, {
                              public_status:
                                VariantListReviewStatusCode.REJECTED,
                            });
                          }}
                        >
                          Reject
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </Td>
                )}
                {user?.is_staff && (
                  <Td>
                    <ButtonWithConfirmation
                      size="sm"
                      colorScheme="red"
                      confirmationPrompt="This cannot be undone."
                      confirmButtonText="Delete"
                      onClick={() => {
                        deletePublicVariantList(publicList);
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

const PublicVariantListsContainer = () => {
  const publicVariantListsStoreRef = useRef<Store<PublicVariantList[]>>(
    atom<PublicVariantList[]>([])
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    get("/public-variant-lists/")
      .then((publicVariantLists) => {
        publicVariantListsStoreRef.current.set(publicVariantLists);
      }, setError)
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <AlertTitle>Unable to load public variant lists</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <PublicVariantLists
      publicVariantListsStore={publicVariantListsStoreRef.current}
    />
  );
};

const PublicListsPage = () => {
  return (
    <>
      <DocumentTitle title="Public Lists" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>Public variant lists</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Public variant lists
      </Heading>

      <PublicVariantListsContainer />
    </>
  );
};

export default PublicListsPage;
