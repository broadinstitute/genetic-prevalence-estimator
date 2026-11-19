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
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Select,
  Spinner,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get, patch, post } from "../../api";
import { USERNAME_LABEL } from "../../constants/config";
import { renderErrorDescription } from "../../errors";
import { Store, atom, useStore } from "../../state";

import DocumentTitle from "../DocumentTitle";
import formatCompactDateTime from "../formatCompactDateTime";
import VirtualizedTable, {
  TableSort,
  VirtualizedTableColumn,
} from "../VirtualizedTable";

import { AddUserButton } from "./AddUser";
import UserActivityCounts, {
  USER_ACTIVITY_FILTERS,
  UserActivityFilter,
} from "./UserActivityCounts";

interface User {
  id: number;
  date_joined: string;
  username: string;
  is_active: boolean;
  is_staff: boolean;
  last_login: string | null;
  last_variant_list_created_at: string | null;
}

type UpdateUser = (
  userToUpdate: User,
  update: { is_active?: boolean; is_staff?: boolean }
) => Promise<User>;

export type UserSortKey =
  | "username"
  | "date_joined"
  | "last_login"
  | "last_variant_list_created_at";

const USERS_DEFAULT_SORT: TableSort<UserSortKey> = {
  key: "date_joined",
  direction: "descending",
};

const getUserSortValue = (user: User, sortKey: UserSortKey) => {
  return user[sortKey];
};

const formatOptionalDateTime = (datetime: string | null) => {
  return datetime === null ? "Never" : formatCompactDateTime(datetime);
};

const userColumns = (
  updateUser: UpdateUser
): VirtualizedTableColumn<User, UserSortKey>[] => {
  return [
    {
      key: "username",
      header: USERNAME_LABEL,
      width: 340,
      sortKey: "username",
      title: (user) => user.username,
      renderCell: (user) => {
        return (
          <>
            {user.username}
            {user.is_staff && (
              <Badge colorScheme="blue" ml="1ch">
                Staff
              </Badge>
            )}
          </>
        );
      },
    },
    {
      key: "is_active",
      header: "Active",
      width: 150,
      renderCell: (user) => {
        return (
          <Menu>
            <MenuButton as={Button} size="sm" rightIcon={<ChevronDownIcon />}>
              {user.is_active ? "Active" : "Inactive"}
            </MenuButton>
            <Portal>
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
                    updateUser(user, { is_active: false });
                  }}
                >
                  Inactive
                </MenuItem>
              </MenuList>
            </Portal>
          </Menu>
        );
      },
    },
    {
      key: "is_staff",
      header: "Staff",
      width: 160,
      renderCell: (user) => {
        return (
          <Menu>
            <MenuButton as={Button} size="sm" rightIcon={<ChevronDownIcon />}>
              {user.is_staff ? "Staff" : "Not staff"}
            </MenuButton>
            <Portal>
              <MenuList>
                <MenuItem
                  onClick={() => {
                    updateUser(user, { is_staff: true });
                  }}
                >
                  Staff
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    updateUser(user, { is_staff: false });
                  }}
                >
                  Not staff
                </MenuItem>
              </MenuList>
            </Portal>
          </Menu>
        );
      },
    },
    {
      key: "date_joined",
      header: "Joined",
      width: 210,
      sortKey: "date_joined",
      renderCell: (user) => formatCompactDateTime(user.date_joined),
    },
    {
      key: "last_login",
      header: "Last sign-in",
      width: 210,
      sortKey: "last_login",
      renderCell: (user) => formatOptionalDateTime(user.last_login),
    },
    {
      key: "last_variant_list_created_at",
      header: "Last list created",
      width: 220,
      sortKey: "last_variant_list_created_at",
      renderCell: (user) =>
        formatOptionalDateTime(user.last_variant_list_created_at),
    },
  ];
};

const UserList = (props: { usersStore: Store<User[]> }) => {
  const users = useStore(props.usersStore);
  const toast = useToast();
  const [activityFilter, setActivityFilter] = useState<UserActivityFilter>(
    "all"
  );
  const filteredUsers = users.filter(
    USER_ACTIVITY_FILTERS[activityFilter].matches
  );

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

      <UserActivityCounts
        users={users}
        selectedFilter={activityFilter}
        onSelectFilter={setActivityFilter}
      />

      <HStack mb={2}>
        <FormControl id="users-activity-filter" width="auto">
          <HStack>
            <FormLabel mb={0}>Show</FormLabel>
            <Select
              size="sm"
              width="auto"
              value={activityFilter}
              onChange={(event) => {
                setActivityFilter(event.target.value as UserActivityFilter);
              }}
            >
              {Object.entries(USER_ACTIVITY_FILTERS).map(
                ([filter, { label }]) => {
                  return (
                    <option key={filter} value={filter}>
                      {label}
                    </option>
                  );
                }
              )}
            </Select>
          </HStack>
        </FormControl>
        <Text>
          {filteredUsers.length.toLocaleString()} of{" "}
          {users.length.toLocaleString()} users
        </Text>
      </HStack>

      <VirtualizedTable
        rows={filteredUsers}
        columns={userColumns(updateUser)}
        defaultSort={USERS_DEFAULT_SORT}
        getSortValue={getUserSortValue}
        tieBreakSortKey="date_joined"
        emptyMessage="No users match this filter."
      />
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
