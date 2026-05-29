import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon } from "@chakra-ui/icons";
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
  Tooltip,
  Text,
  FormControl,
  FormLabel,
  Input,
} from "@chakra-ui/react";
import { sortBy } from "lodash";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RRLink } from "react-router-dom";
import { FixedSizeList } from "react-window";

import { get, patch } from "../api";
import { renderErrorDescription } from "../errors";
import { Store, atom, authStore, useStore } from "../state";
import { VariantListReviewStatusCode } from "../types";

import ButtonWithConfirmation from "./ButtonWithConfirmation";
import {
  Cell,
  useSort,
} from "./DashboardListPage/AllDashboardListsSummaryPage";
import DocumentTitle from "./DocumentTitle";

interface PublicVariantList {
  uuid: string;
  label: string;
  gene_symbol: string;
  gnomad_version: string;
  updated_at: string;
  representative_status: VariantListReviewStatusCode | "";
  representative_status_updated_by: string;
}

interface PublicVariantListColumnDef {
  key: string;
  heading: string;
  headingTooltip?: string;
  isNumeric?: boolean;
  width: number;
  sortKey?: (
    publicVariantList: PublicVariantList
  ) => string | number | (string | number)[];
  render: (
    publicVariantList: PublicVariantList
  ) =>
    | JSX.Element
    | string
    | (JSX.Element | string)[]
    | null
    | undefined
    | false;
}

const PublicVariantLists = (props: {
  publicVariantListsStore: Store<PublicVariantList[]>;
}) => {
  const publicVariantLists = useStore(props.publicVariantListsStore);

  type Filter = {
    searchText: string;
  };
  const [filter, setFilter] = useState<Filter>({
    searchText: "",
  });

  const toast = useToast();
  const { user } = useStore(authStore);
  const userIsStaff = user?.is_staff ? true : false;

  const updateRepresentativeVariantList = (
    publicVariantListToUpdate: PublicVariantList,
    update: { representative_status: VariantListReviewStatusCode | "" }
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
          duration: 3_000,
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
      representative_status: "",
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
          duration: 3_000,
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

  const baseColumns: PublicVariantListColumnDef[] = [
    {
      key: "metadata.gene_symbol",
      heading: "Gene",
      width: 110,
      sortKey: (publicList) => {
        return publicList.gene_symbol ?? "Custom";
      },
      render: (publicList) => {
        return (
          <Cell maxWidth={130}>
            {publicList.gene_symbol ? publicList.gene_symbol : "Custom"}
          </Cell>
        );
      },
    },
    {
      key: "label",
      heading: "Label",
      width: 175,
      sortKey: (publicList) => {
        return publicList.label;
      },
      render: (publicList) => {
        return (
          <Cell maxWidth={130}>
            <Link as={RRLink} to={`/variant-lists/${publicList.uuid}`}>
              {publicList.label}
            </Link>
          </Cell>
        );
      },
    },
    {
      key: "metadata.gnomad_version",
      heading: "gnomAD Version",
      width: 110,
      sortKey: (publicList) => {
        return publicList.gnomad_version;
      },
      render: (publicList) => {
        return <Cell maxWidth={130}>{publicList.gnomad_version}</Cell>;
      },
    },
    {
      key: "representative_status_is_public",
      heading: "Representative",
      width: 140,
      sortKey: (publicList) => {
        return publicList.representative_status;
      },
      render: (publicList) => {
        return (
          <Cell maxWidth={130}>
            {publicList.representative_status === "Approved" ? "Yes" : "No"}
          </Cell>
        );
      },
    },
  ];

  const getRelativeTime = (dateString: string) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return "just now";
    }

    if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    }

    if (hours < 24) {
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }

    if (days < 30) {
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }

    const isCurrentYear = date.getFullYear() === now.getFullYear();
    if (isCurrentYear) {
      return `${date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}`;
    }

    return `${date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`;
  };

  const updatedAtColumn: PublicVariantListColumnDef = {
    key: "updated_at",
    heading: "Updated",
    width: 175,
    sortKey: (publicList) => {
      return publicList.updated_at;
    },
    render: (publicList) => {
      const cellWidth = 130;
      const rawDateString = publicList.updated_at;

      if (!rawDateString) {
        return <Cell maxWidth={cellWidth} />;
      }

      const relativeTimeString = getRelativeTime(rawDateString);
      const exactDateString = new Date(rawDateString).toLocaleString();

      return (
        <Cell maxWidth={130}>
          <Tooltip hasArrow label={exactDateString}>
            <Text
              color={"gray.600"}
              cursor="help"
              textDecoration="underline dotted"
              textUnderlineOffset="2px"
            >
              {relativeTimeString}
            </Text>
          </Tooltip>
        </Cell>
      );
    },
  };

  const staffColumns: PublicVariantListColumnDef[] = [
    {
      key: "representative_status_updated_by",
      heading: "Updated by",
      width: 200,
      sortKey: (publicList) => {
        return publicList.representative_status;
      },
      render: (publicList) => {
        return (
          <Cell maxWidth={130}>
            {publicList.representative_status !== "" && (
              <Tooltip
                hasArrow
                label={publicList.representative_status_updated_by}
              >
                <Text color={"blue.700"}>
                  {publicList.representative_status_updated_by.length > 15
                    ? `${publicList.representative_status_updated_by.slice(
                        0,
                        14
                      )}...`
                    : publicList.representative_status_updated_by}
                </Text>
              </Tooltip>
            )}
          </Cell>
        );
      },
    },
    {
      key: "approval_status",
      heading: "Approval status",
      width: 175,
      sortKey: (publicList) => {
        return publicList.representative_status_updated_by;
      },
      render: (publicList) => {
        return (
          <Cell maxWidth={130}>
            {publicList.representative_status !== "" && (
              <div>
                <div>Dashboard</div>
                <Menu>
                  <MenuButton
                    as={Button}
                    size="sm"
                    backgroundColor={"#dddddd"}
                    rightIcon={<ChevronDownIcon />}
                  >
                    {publicList.representative_status.toString()}
                  </MenuButton>
                  <MenuList>
                    <MenuItem
                      onClick={() => {
                        updateRepresentativeVariantList(publicList, {
                          representative_status:
                            VariantListReviewStatusCode.APPROVED,
                        });
                      }}
                    >
                      Approve
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        updateRepresentativeVariantList(publicList, {
                          representative_status:
                            VariantListReviewStatusCode.REJECTED,
                        });
                      }}
                    >
                      Reject
                    </MenuItem>
                  </MenuList>
                </Menu>
              </div>
            )}
            {publicList.representative_status === "" && "Public"}
          </Cell>
        );
      },
    },
    {
      key: "",
      heading: "Make un-representative",
      width: 175,
      render: (publicList) => {
        return (
          <Cell maxWidth={130}>
            {publicList.representative_status !== "" && (
              <ButtonWithConfirmation
                size="sm"
                colorScheme="red"
                confirmationPrompt="This cannot be undone."
                confirmButtonText="Un-represent"
                onClick={() => {
                  deletePublicVariantList(publicList);
                }}
              >
                Un-represent
              </ButtonWithConfirmation>
            )}
          </Cell>
        );
      },
    },
  ];

  const ROW_HEIGHT = 90;

  const DataRow = ({
    index: dataRowIndex,
    data: { columns, data },
    style,
  }: {
    index: number;
    data: {
      columns: PublicVariantListColumnDef[];
      data: any;
    };
    style: any;
  }) => {
    const rowData = data[dataRowIndex];
    const rowIndex = dataRowIndex + 1;
    return (
      <Tr
        key={rowIndex}
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          boxSizing: "border-box",
          height: `${ROW_HEIGHT}px`,
          background: dataRowIndex % 2 === 1 ? "initial" : "#edf2f7",
        }}
        style={style}
      >
        {columns.map(
          (column: PublicVariantListColumnDef, columnIndex: number) => {
            return (
              <Td
                key={column.key}
                fontWeight="normal"
                isNumeric={column.isNumeric}
                width={`${column.width}px`}
                sx={{
                  height: `${ROW_HEIGHT}px`,
                }}
              >
                {column.render(rowData)}
              </Td>
            );
          }
        )}
      </Tr>
    );
  };

  const columns = [
    ...baseColumns,
    ...(userIsStaff ? staffColumns : []),
    updatedAtColumn,
  ];

  const [sortColumn, sortOrder, setSortKey] = useSort(
    columns,
    "updated_at",
    "descending"
  );

  const filteredPublicVariantLists = useMemo(() => {
    return publicVariantLists.filter((publicVariantList: PublicVariantList) => {
      // const symbolHasMatch =
      //   publicVariantList.gene_symbol?.includes(filter.searchText) ??
      //   false;
      const labelHasMatch = publicVariantList.label.includes(filter.searchText);
      const updatedByHasMatch =
        publicVariantList.representative_status_updated_by?.includes(
          filter.searchText
        ) ?? false;
      // return symbolHasMatch || labelHasMatch || updatedByHasMatch;
      return labelHasMatch || updatedByHasMatch;
    });
  }, [publicVariantLists, filter]);

  const sortedFilteredPublicVariantLists = sortBy(
    filteredPublicVariantLists,
    (publicVariantList) => sortColumn.sortKey!(publicVariantList)
  );
  if (sortOrder === "descending") {
    sortedFilteredPublicVariantLists.reverse();
  }

  return (
    <>
      <Box mb={2}>
        <FormControl>
          <FormLabel>Search</FormLabel>
          <Input
            value={filter.searchText}
            onChange={(e) =>
              setFilter({ ...filter, searchText: e.target.value })
            }
          />
        </FormControl>
      </Box>

      <Table variant="striped">
        <Thead>
          <Tr
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              boxSizing: "border-box",
              borderBottom: "1px solid #e0e0e0",
              height: `${ROW_HEIGHT + 30}px`,
            }}
          >
            {columns.map((column) => {
              return (
                <Th
                  key={column.key}
                  scope="col"
                  isNumeric={column.isNumeric}
                  aria-sort={column.key === sortColumn.key ? sortOrder : "none"}
                  style={{ position: "relative", width: `${column.width}px` }}
                >
                  {column.sortKey ? (
                    <>
                      <button
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          appearance: "none",
                          fontSize: "inherit",
                          fontWeight: "inherit",
                          textAlign: "inherit",
                        }}
                        onClick={() => {
                          setSortKey(column.key);
                        }}
                      >
                        {column.headingTooltip ? (
                          <Tooltip label={column.headingTooltip}>
                            {column.heading}
                          </Tooltip>
                        ) : (
                          column.heading
                        )}
                      </button>
                      {column.key === sortColumn.key && (
                        <span
                          style={{
                            position: "absolute",
                            right: "3px",
                            top: "calc(50% - 10px)",
                          }}
                        >
                          {sortOrder === "descending" ? (
                            <ArrowDownIcon />
                          ) : (
                            <ArrowUpIcon />
                          )}
                        </span>
                      )}
                    </>
                  ) : (
                    column.heading
                  )}
                </Th>
              );
            })}
          </Tr>
        </Thead>

        <Tbody>
          <FixedSizeList
            height={10 * ROW_HEIGHT - 1}
            itemCount={sortedFilteredPublicVariantLists.length}
            itemSize={ROW_HEIGHT}
            width={"100%"}
            overscanCount={5}
            itemData={{
              columns,
              data: sortedFilteredPublicVariantLists,
            }}
            style={{
              overflowX: "hidden",
            }}
          >
            {DataRow}
          </FixedSizeList>
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
