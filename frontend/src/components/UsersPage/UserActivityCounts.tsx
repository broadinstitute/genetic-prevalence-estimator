import {
  Box,
  Button,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  VisuallyHidden,
} from "@chakra-ui/react";

export interface UserActivityDates {
  last_login: string | null;
  last_variant_list_created_at: string | null;
}

export type UserActivityFilter =
  | "all"
  | "signed_in_last_7_days"
  | "signed_in_last_30_days"
  | "signed_in_ever"
  | "created_list_last_7_days"
  | "created_list_last_30_days"
  | "created_list_ever";

const DAY_MS = 24 * 60 * 60 * 1000;

const isWithinDays = (datetime: string | null, days: number) => {
  return (
    datetime !== null &&
    Date.now() - new Date(datetime).getTime() < days * DAY_MS
  );
};

export const USER_ACTIVITY_FILTERS: {
  [key in UserActivityFilter]: {
    label: string;
    matches: (user: UserActivityDates) => boolean;
  };
} = {
  all: { label: "All users", matches: () => true },
  signed_in_last_7_days: {
    label: "Signed in, last 7 days",
    matches: (user) => isWithinDays(user.last_login, 7),
  },
  signed_in_last_30_days: {
    label: "Signed in, last 30 days",
    matches: (user) => isWithinDays(user.last_login, 30),
  },
  signed_in_ever: {
    label: "Signed in, all time",
    matches: (user) => user.last_login !== null,
  },
  created_list_last_7_days: {
    label: "Created a list, last 7 days",
    matches: (user) => isWithinDays(user.last_variant_list_created_at, 7),
  },
  created_list_last_30_days: {
    label: "Created a list, last 30 days",
    matches: (user) => isWithinDays(user.last_variant_list_created_at, 30),
  },
  created_list_ever: {
    label: "Created a list, all time",
    matches: (user) => user.last_variant_list_created_at !== null,
  },
};

const SIGNED_IN_LAST_7_DAYS_UNDERCOUNT_EXPLANATION =
  "Undercounts: a sign-in lasts 2 weeks, so people still signed in from an earlier sign-in are not counted.";

const CountButton = ({
  users,
  filter,
  selectedFilter,
  onSelectFilter,
}: {
  users: UserActivityDates[];
  filter: UserActivityFilter;
  selectedFilter: UserActivityFilter;
  onSelectFilter: (filter: UserActivityFilter) => void;
}) => {
  const count = users.filter(USER_ACTIVITY_FILTERS[filter].matches).length;
  const isSelected = filter === selectedFilter;

  return (
    <Button
      variant="link"
      fontWeight={isSelected ? "bold" : "normal"}
      textDecoration={isSelected ? "underline" : "none"}
      aria-pressed={isSelected}
      aria-label={`Show users: ${USER_ACTIVITY_FILTERS[filter].label} (${count})`}
      onClick={() => {
        onSelectFilter(filter);
      }}
    >
      {count.toLocaleString()}
    </Button>
  );
};

const UserActivityCounts = ({
  users,
  selectedFilter,
  onSelectFilter,
}: {
  users: UserActivityDates[];
  selectedFilter: UserActivityFilter;
  onSelectFilter: (filter: UserActivityFilter) => void;
}) => {
  const countButtonProps = { users, selectedFilter, onSelectFilter };

  return (
    <Table size="sm" maxWidth="700px" mb={4}>
      <Thead>
        <Tr>
          <Th scope="col">
            <VisuallyHidden>Activity</VisuallyHidden>
          </Th>
          <Th scope="col" isNumeric>
            Last 7 days
          </Th>
          <Th scope="col" isNumeric>
            Last 30 days
          </Th>
          <Th scope="col" isNumeric>
            All time
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Th scope="row">Signed in</Th>
          <Td isNumeric>
            <CountButton filter="signed_in_last_7_days" {...countButtonProps} />
            <Tooltip label={SIGNED_IN_LAST_7_DAYS_UNDERCOUNT_EXPLANATION}>
              <Box
                as="span"
                ml={2}
                tabIndex={0}
                cursor="help"
                aria-label={SIGNED_IN_LAST_7_DAYS_UNDERCOUNT_EXPLANATION}
              >
                ⓘ
              </Box>
            </Tooltip>
          </Td>
          <Td isNumeric>
            <CountButton
              filter="signed_in_last_30_days"
              {...countButtonProps}
            />
          </Td>
          <Td isNumeric>
            <CountButton filter="signed_in_ever" {...countButtonProps} />
          </Td>
        </Tr>
        <Tr>
          <Th scope="row">Created a list</Th>
          <Td isNumeric>
            <CountButton
              filter="created_list_last_7_days"
              {...countButtonProps}
            />
          </Td>
          <Td isNumeric>
            <CountButton
              filter="created_list_last_30_days"
              {...countButtonProps}
            />
          </Td>
          <Td isNumeric>
            <CountButton filter="created_list_ever" {...countButtonProps} />
          </Td>
        </Tr>
      </Tbody>
    </Table>
  );
};

export default UserActivityCounts;
