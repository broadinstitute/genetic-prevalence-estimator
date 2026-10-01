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
  Portal,
  Spinner,
  Table,
  Text,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link as RRLink } from "react-router-dom";
import { FixedSizeList } from "react-window";

import { get, patch, post } from "../../api";
import { USERNAME_LABEL } from "../../constants/config";
import { renderErrorDescription } from "../../errors";
import { Store, atom, useStore } from "../../state";

import DocumentTitle from "../DocumentTitle";

import { AddUserButton } from "./AddUser";

interface User {
  id: number;
  date_joined: string;
  username: string;
  is_active: boolean;
  is_staff: boolean;
}

type UpdateUser = (
  userToUpdate: User,
  update: { is_active?: boolean; is_staff?: boolean }
) => Promise<User>;

interface UserRowData {
  users: User[];
  updateUser: UpdateUser;
}

const ROW_HEIGHT = 70;
const USERS_DISPLAYED = 10;

const UserRow = ({
  index,
  data,
  style,
}: {
  index: number;
  data: UserRowData;
  style: React.CSSProperties;
}) => {
  const user = data.users[index];

  return (
    <Tr
      key={user.id}
      sx={{
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        background: index % 2 === 1 ? "initial" : "#edf2f7",
      }}
      style={style}
    >
      <Td width="35%">
        {user.username}
        {user.is_staff && (
          <Badge colorScheme="blue" ml="1ch">
            Staff
          </Badge>
        )}
      </Td>
      <Td width="20%">
        <Menu>
          <MenuButton as={Button} size="sm" rightIcon={<ChevronDownIcon />}>
            {user.is_active ? "Active" : "Inactive"}
          </MenuButton>
          <Portal>
            <MenuList>
              <MenuItem
                onClick={() => {
                  data.updateUser(user, { is_active: true });
                }}
              >
                Active
              </MenuItem>
              <MenuItem
                onClick={() => {
                  data.updateUser(user, { is_active: false });
                }}
              >
                Inactive
              </MenuItem>
            </MenuList>
          </Portal>
        </Menu>
      </Td>
      <Td width="20%">
        <Menu>
          <MenuButton as={Button} size="sm" rightIcon={<ChevronDownIcon />}>
            {user.is_staff ? "Staff" : "Not staff"}
          </MenuButton>
          <Portal>
            <MenuList>
              <MenuItem
                onClick={() => {
                  data.updateUser(user, { is_staff: true });
                }}
              >
                Staff
              </MenuItem>
              <MenuItem
                onClick={() => {
                  data.updateUser(user, { is_staff: false });
                }}
              >
                Not staff
              </MenuItem>
            </MenuList>
          </Portal>
        </Menu>
      </Td>
      <Td width="25%">
        {new Date(user.date_joined).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </Td>
    </Tr>
  );
};

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

      <Text mb={2} mt={2}>
        Total users: {users.length}
      </Text>

      <Table variant="striped">
        <Thead>
          <Tr sx={{ display: "flex" }}>
            <Th scope="col" width="35%">
              {USERNAME_LABEL}
            </Th>
            <Th scope="col" width="20%">
              Active
            </Th>
            <Th scope="col" width="20%">
              Staff
            </Th>
            <Th scope="col" width="25%">
              Date joined
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          <FixedSizeList
            height={Math.min(users.length, USERS_DISPLAYED) * ROW_HEIGHT}
            itemCount={users.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            overscanCount={5}
            itemData={{ users, updateUser }}
            style={{ overflowX: "hidden" }}
          >
            {UserRow}
          </FixedSizeList>
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
