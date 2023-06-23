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

import { del, get, patch } from "../api";
import { renderErrorDescription } from "../errors";
import { Store, atom, authStore, useStore } from "../state";
import { VariantListPublicStatusCode } from "../types";

import ButtonWithConfirmation from "./ButtonWithConfirmation";
import DocumentTitle from "./DocumentTitle";

interface PublicVariantList {
  variant_list: number;
  variant_list_uuid: string;
  variant_list_label: string;
  variant_list_gene_symbol: string;
  submitted_by: string;
  submitted_at: string;
  public_status: VariantListPublicStatusCode;
  reviewed_by: string;
  reviewed_at: string;
}

const PublicVariantLists = (props: {
  publicVariantListsStore: Store<PublicVariantList[]>;
}) => {
  const publicVariantLists = useStore(props.publicVariantListsStore);
  const toast = useToast();
  const { user } = useStore(authStore);

  const updatePublicVariantList = (
    publicVariantListToUpdate: PublicVariantList,
    update: { public_status: VariantListPublicStatusCode; reviewed_by: String }
  ): Promise<PublicVariantList> => {
    return patch(
      `/public-variant-list/${publicVariantListToUpdate.variant_list}/`,
      update
    ).then(
      (updatedPublicVariantList) => {
        props.publicVariantListsStore.set(
          publicVariantLists.map((otherPublicVariantList) => {
            return otherPublicVariantList.variant_list ===
              updatedPublicVariantList.variant_list
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
    return del(
      `/public-variant-list/${publicVariantListToDelete.variant_list}/`
    ).then(
      () => {
        props.publicVariantListsStore.set(
          publicVariantLists.filter(
            (otherPublicVariantList) =>
              otherPublicVariantList.variant_list !==
              publicVariantListToDelete.variant_list
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
            <Th>GENE</Th>
            <Th>LABEL</Th>
            <Th>SUBMITTER</Th>
            {user?.is_staff && <Th>REVIEWER</Th>}
            {user?.is_staff && <Th>APPROVAL STATUS</Th>}
            {user?.is_staff && <Th>REMOVE LIST</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {publicVariantLists.map((publicList: PublicVariantList) => {
            return (
              <Tr key={publicList.variant_list_uuid}>
                <Td>{publicList.variant_list_gene_symbol}</Td>
                <Td>
                  <Link
                    as={RRLink}
                    to={`/variant-lists/${publicList.variant_list_uuid}`}
                  >
                    {publicList.variant_list_label}
                  </Link>
                </Td>
                <Td>{publicList.submitted_by}</Td>
                {user?.is_staff && <Td>{publicList.reviewed_by}</Td>}
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
                                VariantListPublicStatusCode.APPROVED,
                              reviewed_by: user?.username,
                            });
                          }}
                        >
                          Approve
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            updatePublicVariantList(publicList, {
                              public_status:
                                VariantListPublicStatusCode.REJECTED,
                              reviewed_by: user?.username,
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
            <span>Public Variant Lists</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Public Variant Lists
      </Heading>

      <PublicVariantListsContainer />
    </>
  );
};

export default PublicListsPage;
