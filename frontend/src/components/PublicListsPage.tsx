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
import { Link as RRLink } from "react-router-dom";

import { del, get, patch } from "../api";

import { useEffect, useRef, useState } from "react";

import DocumentTitle from "./DocumentTitle";

import { Store, atom, authStore, useStore } from "../state";
import { renderErrorDescription } from "../errors";
import ButtonWithConfirmation from "./ButtonWithConfirmation";

enum PublicStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

interface PublicVariantList {
  number: number;
  uuid: string;
  creator: string;
  approval_status: PublicStatus;
  // TODO:
  variant_list: {
    uuid: string;
  };
}

const PublicVariantLists = (props: {
  publicVariantListsStore: Store<PublicVariantList[]>;
}) => {
  const publicVariantLists = useStore(props.publicVariantListsStore);
  const toast = useToast();
  const { user } = useStore(authStore);

  const updatePublicVariantList = (
    publicVariantListToUpdate: PublicVariantList,
    update: { approval_status: PublicStatus; reviewed_by: String }
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
    return del(`/public-variant-lists/${publicVariantListToDelete.uuid}/`).then(
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
            <Th>GENE</Th>
            <Th>LABEL</Th>
            {/* <Th>UUID</Th> */}
            <Th>SUBMITTER</Th>
            {user?.is_staff && <Th>REVIEWER</Th>}
            {user?.is_staff && <Th>APPROVAL STATUS</Th>}
            {user?.is_staff && <Th>REMOVE LIST</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {publicVariantLists.map((publicList: any) => {
            return (
              <Tr key={publicList.uuid}>
                <Td>{publicList.variant_list.metadata.gene_symbol}</Td>
                <Td>
                  <Link
                    as={RRLink}
                    to={`/variant-lists/${publicList.variant_list.uuid}`}
                  >
                    {publicList.variant_list.label}
                  </Link>
                </Td>
                {/* <Td>{publicList.uuid}</Td> */}
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
                        {publicList.approval_status.toString()}
                      </MenuButton>
                      <MenuList>
                        <MenuItem
                          onClick={() => {
                            updatePublicVariantList(publicList, {
                              approval_status: PublicStatus.APPROVED,
                              reviewed_by: user?.username,
                            });
                          }}
                        >
                          Approve
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            updatePublicVariantList(publicList, {
                              approval_status: PublicStatus.REJECTED,
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

// TODO:FIXME:TODO:FIXME: DELETE ME!
// const PublicListsView = () => {
//   const { isSignedIn, user } = useStore(authStore);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<Error | null>(null);

//   const mockPublicLists: PublicVariantList[] = [
//     {
//       number: 1,
//       uuid: "fake_uuid_12345",
//       creator: "rgrant@broadinstitute.org",
//       approval_status: PublicStatus.APPROVED,
//       variant_list: "yeh",
//     },
//     {
//       number: 2,
//       uuid: "fake_uuid_23456",
//       creator: "rgrant@broadinstitute.org",
//       approval_status: PublicStatus.PENDING,
//       variant_list: "yeh",
//     },
//     {
//       number: 3,
//       uuid: "fake_uuid_34567",
//       creator: "rileygrant46@gmail.com",
//       approval_status: PublicStatus.REJECTED,
//       variant_list: "yeh",
//     },
//   ];
//   const [publicVariantLists, setPublicVariantLists] = useState(mockPublicLists);
//   const toast = useToast();

//   const updateList = (
//     listToUpdate: PublicVariantList,
//     update: { approval_status?: PublicStatus }
//   ): Promise<PublicVariantList> => {
//     return patch(`/public-variant-lists/${listToUpdate.uuid}/`, update).then(
//       (updatedList: any) => {
//         setPublicVariantLists(
//           publicVariantLists.map((list) => {
//             return list.uuid === updatedList.uuid ? updatedList : list;
//           })
//         );
//         toast({
//           title: "Approval status updated",
//           status: "success",
//           duration: 30000,
//           isClosable: true,
//         });
//         return updatedList;
//       },
//       (error) => {
//         toast({
//           title: "Unable to update the approval status",
//           description: renderErrorDescription(error),
//           status: "error",
//           duration: 10000,
//           isClosable: true,
//         });
//       }
//     );
//   };

//   useEffect(() => {
//     setIsLoading(true);
//     get("/public-variant-lists/", {})
//       .then(
//         (publicVariantLists) => setPublicVariantLists(publicVariantLists),
//         setError
//       )
//       .finally(() => {
//         setIsLoading(false);
//         console.log(publicVariantLists);
//       });
//   }, []);

//   useEffect(() => {
//     console.log("wil dis work");
//     console.log(publicVariantLists);
//   }, [publicVariantLists]);

//   let content = null;

//   if (isLoading) {
//     content = (
//       <Center>
//         <Spinner size="lg" />
//       </Center>
//     );
//   } else {
//     content = (
//       <Table variant="striped">
//         <Thead>
//           <Tr>
//             {/* <Th>NUMBER</Th> */}
//             <Th>GENE</Th>
//             {/* <Th>UUID</Th> */}
//             <Th>LINK</Th>
//             <Th>SUBMITTOR</Th>
//             {user?.is_staff && <Th>APPROVAL STATUS</Th>}
//           </Tr>
//         </Thead>
//         <Tbody>
//           {publicVariantLists.map((publicList: any) => {
//             return (
//               <Tr key={publicList.uuid}>
//                 {/* <Td>{mockList.number}</Td> */}
//                 <Td>{publicList.variant_list.metadata.gene_symbol}</Td>
//                 <Td>
//                   <Link
//                     as={RRLink}
//                     to={`/variant-lists/${publicList.variant_list.uuid}`}
//                   >
//                     {/* {publicList.uuid} */}
//                     {publicList.variant_list.uuid}
//                   </Link>
//                 </Td>
//                 <Td>{`TODO-ADD-SUBMITTER-TO-MODEL`}</Td>
//                 {user?.is_staff && (
//                   <Td>
//                     <Menu>
//                       <MenuButton
//                         as={Button}
//                         size="sm"
//                         rightIcon={<ChevronDownIcon />}
//                       >
//                         {publicList.approval_status.toString()}
//                       </MenuButton>
//                       <MenuList>
//                         <MenuItem
//                           onClick={() => {
//                             updateList(publicList, {
//                               approval_status: PublicStatus.APPROVED,
//                             });
//                           }}
//                         >
//                           Approve
//                         </MenuItem>
//                         <MenuItem
//                           onClick={() => {
//                             updateList(publicList, {
//                               approval_status: PublicStatus.REJECTED,
//                             });
//                           }}
//                         >
//                           Reject
//                         </MenuItem>
//                       </MenuList>
//                     </Menu>
//                   </Td>
//                 )}
//               </Tr>
//             );
//           })}
//         </Tbody>
//       </Table>
//     );
//   }

//   return (
//     <>
//       {!!isSignedIn && (
//         <>
//           <Heading as="h3" size="md" mb={4}>
//             Signed in!
//           </Heading>
//           <Text>Role staff?: {user?.is_staff?.toString()}</Text>
//           {console.log(user)}
//         </>
//       )}

//       {content}

//       <Text mb={4}>
//         Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
//         tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
//         veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
//         commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
//         velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
//         occaecat cupidatat non proident, sunt in culpa qui officia deserunt
//         mollit anim id est laborum
//       </Text>
//       <Heading as="h3" size="md" mb={4}>
//         Currently public lists (uuid)
//       </Heading>
//       <Table variant="striped">
//         <Thead>
//           <Tr>
//             <Th>NUMBER</Th>
//             <Th>UUID</Th>
//             <Th>CREATOR</Th>
//             {user?.is_staff && <Th>APPROVAL STATUS</Th>}
//           </Tr>
//         </Thead>
//         <Tbody>
//           {mockPublicLists.map((mockList: any) => {
//             return (
//               <Tr key={mockList.uuid}>
//                 <Td>{mockList.number}</Td>
//                 <Td>
//                   <Link as={RRLink} to="/TODO">
//                     {mockList.uuid}
//                   </Link>
//                 </Td>
//                 <Td>{mockList.creator}</Td>
//                 {user?.is_staff && (
//                   <Td>
//                     <Menu>
//                       <MenuButton
//                         as={Button}
//                         size="sm"
//                         rightIcon={<ChevronDownIcon />}
//                       >
//                         {mockList.approval_status.toString()}
//                       </MenuButton>
//                       <MenuList>
//                         <MenuItem
//                           onClick={() => {
//                             updateList(mockList, {
//                               approval_status: PublicStatus.APPROVED,
//                             });
//                           }}
//                         >
//                           Approve
//                         </MenuItem>
//                         <MenuItem
//                           onClick={() => {
//                             updateList(mockList, {
//                               approval_status: PublicStatus.REJECTED,
//                             });
//                           }}
//                         >
//                           Reject
//                         </MenuItem>
//                       </MenuList>
//                     </Menu>
//                   </Td>
//                 )}
//               </Tr>
//             );
//           })}
//         </Tbody>
//       </Table>
//     </>
//   );
// };
