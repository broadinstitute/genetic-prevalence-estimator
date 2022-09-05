import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Center,
  Divider,
  Heading,
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get, patch, post } from "../../api";
import { USERNAME_LABEL } from "../../constants/config";
import { renderErrorDescription } from "../../errors";
import { Store, atom, useStore } from "../../state";

import DocumentTitle from "../DocumentTitle";

import { AddUserButton } from "./AddUser";

interface User {
  id: number;
  username: string;
  is_active: boolean;
  is_staff: boolean;
}

const UserList = (props: { usersStore: Store<User[]> }) => {
  const users = useStore(props.usersStore);
  const toast = useToast();

  const updateUser = (
    userToUpdate: User,
    update: { is_active?: boolean; is_staff?: boolean }
  ): Promise<User> => {
    return patch(`/users/${userToUpdate.id}/`, update).then(
      (updatedUser) => {
        props.usersStore.set(
          users.map((otherUser) => {
            return otherUser.id === updatedUser.id ? updatedUser : otherUser;
          })
        );
        toast({
          title: "User updated",
          status: "success",
          duration: 30000,
          isClosable: true,
        });
        return updatedUser;
      },
      (error) => {
        toast({
          title: "Unable to update user",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10000,
          isClosable: true,
        });
      }
    );
  };

  return (
    <>
      <HStack>
        <AddUserButton
          size="sm"
          onAddUser={(newUser: { username: string }) => {
            post(`/users/`, newUser).then(
              (newUser) => {
                props.usersStore.set([...users, newUser]);
                toast({
                  title: "User created",
                  status: "success",
                  duration: 30000,
                  isClosable: true,
                });
              },
              (error) => {
                toast({
                  title: "Unable to create user",
                  description: renderErrorDescription(error),
                  status: "error",
                  duration: 10000,
                  isClosable: true,
                });
              }
            );
          }}
        >
          Add user
        </AddUserButton>
      </HStack>

      <Divider mb={2} mt={2} />

      <Table variant="striped">
        <Thead>
          <Tr>
            <Th scope="col">{USERNAME_LABEL}</Th>
            <Th scope="col">Active</Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map((user) => {
            return (
              <Tr key={user.username}>
                <Td>
                  {user.username}
                  {user.is_staff && (
                    <Badge colorScheme="blue" ml="1ch">
                      Staff
                    </Badge>
                  )}
                </Td>
                <Td>
                  <Menu>
                    <MenuButton
                      as={Button}
                      size="sm"
                      rightIcon={<ChevronDownIcon />}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </MenuButton>
                    <MenuList>
                      <MenuItem
                        onClick={() => {
                          updateUser(user, { is_active: true });
                        }}
                      >
                        Active
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          updateUser(user, { is_active: true });
                        }}
                      >
                        Inactive
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

const UsersContainer = () => {
  const usersStoreRef = useRef<Store<User[]>>(atom<User[]>([]));

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    get("/users/")
      .then((users) => {
        usersStoreRef.current.set(users);
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
        <AlertTitle>Unable to load variant lists</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return <UserList usersStore={usersStoreRef.current} />;
};

const UsersPage = () => {
  return (
    <>
      <DocumentTitle title="Users" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>Users</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Users
      </Heading>

      <UsersContainer />
    </>
  );
};

export default UsersPage;
