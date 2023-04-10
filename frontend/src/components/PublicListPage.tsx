import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
  Text,
  Link,
  ListItem,
  UnorderedList,
  Table,
  Thead,
  Tbody,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Tfoot,
  Tr,
  Th,
  Td,
  TableCaption,
  TableContainer,
  useToast,
} from "@chakra-ui/react";
import { Link as RRLink } from "react-router-dom";

import { get, patch, post } from "../api";

import DocumentTitle from "./DocumentTitle";

import { authStore, loadCurrentUser, loadAppConfig, useStore } from "../state";
import { renderErrorDescription } from "../errors";

enum PublicStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

interface VariantList {
  number: number;
  uuid: any;
  creator: string;
  approval_status: PublicStatus;
}

const PublicListsView = () => {
  const { isSignedIn, user } = useStore(authStore);
  const toast = useToast();

  const updateList = (
    listToUpdate: VariantList,
    update: { approval_status?: PublicStatus }
  ): Promise<VariantList> => {
    return patch(`TODO`, update).then(
      (updatedList: any) => {
        // TODO:
        console.log(updatedList);
        toast({
          title: "Variant list updated",
          status: "success",
          duration: 30000,
          isClosable: true,
        });
        return updatedList;
      },
      (error) => {
        toast({
          title: "Unable to update list",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10000,
          isClosable: true,
        });
      }
    );
  };

  const mockPublicLists: VariantList[] = [
    {
      number: 1,
      uuid: "fake_uuid_12345",
      creator: "rgrant@broadinstitute.org",
      approval_status: PublicStatus.APPROVED,
    },
    {
      number: 2,
      uuid: "fake_uuid_23456",
      creator: "rgrant@broadinstitute.org",
      approval_status: PublicStatus.PENDING,
    },
    {
      number: 3,
      uuid: "fake_uuid_34567",
      creator: "rileygrant46@gmail.com",
      approval_status: PublicStatus.REJECTED,
    },
  ];

  return (
    <>
      {!!isSignedIn && (
        <>
          <Heading as="h3" size="md" mb={4}>
            Signed in!
          </Heading>
          <Text>Role staff?: {user?.is_staff?.toString()}</Text>
          {console.log(user)}
        </>
      )}

      <Text mb={4}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
        velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
        occaecat cupidatat non proident, sunt in culpa qui officia deserunt
        mollit anim id est laborum
      </Text>
      <Heading as="h3" size="md" mb={4}>
        Currently public lists (uuid)
      </Heading>
      <Table variant="striped">
        <Thead>
          <Tr>
            <Th>NUMBER</Th>
            <Th>UUID</Th>
            <Th>CREATOR</Th>
            <Th>APPROVAL STATUS</Th>
          </Tr>
        </Thead>
        <Tbody>
          {mockPublicLists.map((mockList: any) => {
            return (
              <Tr key={mockList.uuid}>
                <Td>{mockList.number}</Td>
                <Td>
                  <Link as={RRLink} to="/TODO">
                    {mockList.uuid}
                  </Link>
                </Td>
                <Td>{mockList.creator}</Td>
                <Td>
                  <Menu>
                    <MenuButton
                      as={Button}
                      size="sm"
                      rightIcon={<ChevronDownIcon />}
                    >
                      {mockList.approval_status.toString()}
                    </MenuButton>
                    <MenuList>
                      <MenuItem
                        onClick={() => {
                          updateList(mockList, {
                            approval_status: PublicStatus.APPROVED,
                          });
                        }}
                      >
                        Approve
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          updateList(mockList, {
                            approval_status: PublicStatus.REJECTED,
                          });
                        }}
                      >
                        Reject
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </>
  );
};

const PublicListsPage = () => {
  return (
    <>
      <DocumentTitle title="About" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>Public Lists</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Public Lists
      </Heading>

      <PublicListsView />
    </>
  );
};

export default PublicListsPage;
