import { ArrowDownIcon, ArrowUpIcon } from "@chakra-ui/icons";
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
  Input,
  Link,
  Table,
  Thead,
  Tbody,
  Spinner,
  Tr,
  Th,
  Td,
  useToast,
  Tooltip,
  Badge,
} from "@chakra-ui/react";
import { sortBy } from "lodash";

import { FC, useCallback, useEffect, useRef, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { del, get, postFile } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, atom, authStore, useStore } from "../../state";
import { VariantList } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DocumentTitle from "../DocumentTitle";

import { renderFrequencyFraction } from "../VariantListPage/VariantListCalculations/calculationsDisplayFormats";

type DashboardList = {
  gene_id: string;
  gene_symbol: string;
  label: string;
  metadata: {
    gnomad_version: string;
    reference_genome: string;
    gene_symbol: string;
  };
  estimates: {
    genetic_prevalence: number[];
  };
  genetic_prevalence_orphanet: string;
  genetic_prevalence_genereviews: string;
  genetic_prevalence_other: string;
  representative_variant_list?: VariantList & {
    estimates: {
      genetic_prevalence: {
        global: number;
      };
      carrier_frequency: {
        global: number;
      };
    };
    supporting_documents?: string;
  };
  inheritance_type: string;
};

const MultipleInheritanceFlag = () => {
  return (
    <Tooltip
      hasArrow
      label="This gene is associated with multiple inheritance patterns"
    >
      <Badge colorScheme="yellow" fontSize="0.8em" ml={2} style={{ order: -1 }}>
        I
      </Badge>
    </Tooltip>
  );
};

const MultipleDiseaseFlag = () => {
  return (
    <Tooltip hasArrow label="This gene is associated with multiple diseases">
      <Badge colorScheme="yellow" fontSize="0.8em" ml={2} style={{ order: -1 }}>
        D
      </Badge>
    </Tooltip>
  );
};

const Cell: FC<{ maxWidth: number }> = ({ children, maxWidth }) => {
  return (
    <span
      style={{
        display: "inline-block",
        maxWidth: `${maxWidth}px`,
        overflow: "hidden",
        textOverflow: "ellipses",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};

const orphanetPrevalencesRemappings: { [key: string]: string } = {
  multiple_prevalences: "Multiple prevalences",
  "-": "No estimated prevalence",
};

interface ColumnDef {
  key: string;
  heading: string;
  isNumeric?: boolean;
  sortKey?: (
    dashboardList: DashboardList
  ) => string | number | (string | number)[];
  render: (
    dashboardList: DashboardList
  ) =>
    | JSX.Element
    | string
    | (JSX.Element | string)[]
    | null
    | undefined
    | false;
}

const BASE_COLUMNS: ColumnDef[] = [
  {
    key: "gene_symbol",
    heading: "Gene Symbol",
    sortKey: (dashboardList) => {
      return dashboardList.gene_symbol;
    },
    render: (dashboardList) => {
      return (
        <Cell maxWidth={130}>
          {dashboardList.gene_symbol}
          {dashboardList.inheritance_type.includes("/") && (
            <MultipleInheritanceFlag />
          )}
          {dashboardList.genetic_prevalence_orphanet ===
            "multiple_prevalences" && <MultipleDiseaseFlag />}
        </Cell>
      );
    },
  },

  {
    key: "dashboard_estimate",
    heading: "ClinVar LP/P and gnomaD LoF",
    sortKey: (dashboardList) => {
      return dashboardList.estimates.genetic_prevalence[0] !== 0
        ? Math.round(1 / dashboardList.estimates.genetic_prevalence[0])
        : 0;
    },
    render: (dashboardList) => {
      return (
        <Cell maxWidth={200}>
          <Link as={RRLink} to={`/dashboard-lists/${dashboardList.gene_id}`}>
            {renderFrequencyFraction(
              dashboardList.estimates.genetic_prevalence[0]
            )}
          </Link>
        </Cell>
      );
    },
  },

  {
    key: "representative_estimate",
    heading: "Estimates available on GeniE",
    sortKey: (dashboardList) => {
      if (dashboardList.representative_variant_list) {
        return dashboardList.representative_variant_list.estimates
          .genetic_prevalence.global !== 0
          ? Math.round(
              1 /
                dashboardList.representative_variant_list.estimates
                  .genetic_prevalence.global
            )
          : 0;
      }
      return 0;
    },
    render: (dashboardList) => {
      return (
        <Cell maxWidth={200}>
          {dashboardList.representative_variant_list && (
            <Link
              as={RRLink}
              to={`/variant-lists/${dashboardList.representative_variant_list.uuid}`}
            >
              {renderFrequencyFraction(
                dashboardList.representative_variant_list.estimates
                  .genetic_prevalence.global
              )}
            </Link>
          )}
          {!dashboardList.representative_variant_list && ""}
        </Cell>
      );
    },
  },

  {
    key: "representative_contact",
    heading: "Contact for public estimate",
    render: (dashboardList) => {
      const ownersArray = dashboardList.representative_variant_list
        ? dashboardList
            .representative_variant_list!.access_permissions!.filter(
              (ap) => ap.level === "Owner"
            )
            .map((ap) => ap.user)
        : [""];

      return <Cell maxWidth={200}>{ownersArray[0]}</Cell>;
    },
  },

  {
    key: "supporting_documents",
    heading: "Supporting documents",
    render: (dashboardList) => {
      return (
        <Cell maxWidth={200}>
          {dashboardList.representative_variant_list &&
            dashboardList.representative_variant_list.supporting_documents && (
              <Link
                href={
                  dashboardList.representative_variant_list.supporting_documents
                }
                isExternal
                target="_blank"
              >
                {/* TODO: include supporting documents on dashboard list model */}
                {"documents"}
              </Link>
            )}
        </Cell>
      );
    },
  },

  {
    key: "prevalence_orphanet",
    heading: "Prevalence orphanet",
    sortKey: (dashboardList) => {
      return dashboardList.genetic_prevalence_orphanet;
    },
    render: (dashboardList) => {
      const orphanetPrevalence = dashboardList.genetic_prevalence_orphanet;

      return (
        <Cell maxWidth={200}>
          <Link
            href={`https://www.orpha.net/en/disease`}
            isExternal
            target="_blank"
          >
            {orphanetPrevalence in orphanetPrevalencesRemappings
              ? orphanetPrevalencesRemappings[orphanetPrevalence]
              : orphanetPrevalence}
          </Link>
        </Cell>
      );
    },
  },
];

type SortOrder = "ascending" | "descending";
interface SortState {
  key: string;
  order: SortOrder;
}

const useSort = (
  columns: ColumnDef[],
  defaultSortKey: string,
  defaultSortOrder: SortOrder = "ascending"
): [ColumnDef, SortOrder, (sortKey: string) => void] => {
  const defaultSortColumn = columns.find(
    (column) => column.key === defaultSortKey
  )!;
  const [sortState, setSortState] = useState<SortState>({
    key: defaultSortColumn.key,
    order: defaultSortOrder,
  });

  const setSortKey = useCallback(
    (sortKey: string) =>
      setSortState((prevSortState) => {
        if (sortKey === prevSortState.key) {
          return {
            ...prevSortState,
            order:
              prevSortState.order === "ascending" ? "descending" : "ascending",
          };
        }
        return { key: sortKey, order: "ascending" };
      }),
    []
  );

  const selectedSortColumn = columns.find(
    (column) => column.key === sortState.key
  );
  if (!selectedSortColumn) {
    return [defaultSortColumn, "ascending", setSortKey];
  }

  return [selectedSortColumn, sortState.order, setSortKey];
};

const DashboardLists = (props: {
  dashboardListsStore: Store<DashboardList[]>;
}) => {
  const dashboardLists = useStore(props.dashboardListsStore);

  const toast = useToast();
  const { user } = useStore(authStore);
  const userIsStaff = user?.is_staff ? true : false;

  const STAFF_COLUMNS: ColumnDef[] = [
    {
      key: "delete_dashboard_list",
      heading: "",
      render: (dashboardList) => {
        return (
          <Cell maxWidth={200}>
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
          </Cell>
        );
      },
    },
  ];

  const columns = [
    ...BASE_COLUMNS,
    ...(userIsStaff ? STAFF_COLUMNS : ([] as ColumnDef[])),
  ];

  const [sortColumn, sortOrder, setSortKey] = useSort(
    columns,
    "gene_symbol",
    "ascending"
  );

  const sortedDashboardLists = sortBy(dashboardLists, (dashboardList) =>
    sortColumn.sortKey!(dashboardList)
  );
  if (sortOrder === "descending") {
    sortedDashboardLists.reverse();
  }

  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (event: any) => {
    setFile(event.target.files[0]);
  };

  const loadDashboardLists = (): Promise<void> => {
    if (!file) {
      toast({
        title: "You need to add a file",
        status: "error",
        duration: 10_000,
        isClosable: true,
      });
      return new Promise<void>((resolve, reject) => resolve());
    }

    const formData = new FormData();
    const blob = new Blob([file!], { type: file!.type });
    formData.append("csv_file", blob, file!.name);

    return postFile(`/dashboard-lists/load`, formData).then(
      () => {
        toast({
          title: "Dashboard lists loaded!",
          status: "success",
          duration: 30_000,
          isClosable: true,
        });
        setFile(null);
      },
      (error) => {
        toast({
          title: "Unable to load dashboard lists",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      }
    );
  };

  const deleteDashboardList = (
    dashboardListToDelete: DashboardList
  ): Promise<void> => {
    return del(`/dashboard-lists/${dashboardListToDelete.gene_id}/`).then(
      () => {
        props.dashboardListsStore.set(
          dashboardLists.filter(
            (otherDashboardList) =>
              otherDashboardList.gene_id !== dashboardListToDelete.gene_id
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
      {userIsStaff && (
        <>
          <Input
            type="file"
            onChange={handleFileChange}
            placeholder="Add a file populate lists"
            size="md"
            sx={{
              "::file-selector-button": {
                height: 10,
                padding: 0,
                mr: 4,
                background: "none",
                border: "none",
                fontWeight: "bold",
              },
            }}
          />

          <ButtonWithConfirmation
            size="sm"
            colorScheme="blue"
            confirmationPrompt="This cannot be undone."
            confirmButtonText="Re-load"
            onClick={() => {
              loadDashboardLists();
            }}
          >
            Load
          </ButtonWithConfirmation>
        </>
      )}

      <Table variant="striped">
        <Thead>
          <Tr>
            {columns.map((column) => {
              return (
                <Th
                  key={column.key}
                  scope="col"
                  isNumeric={column.isNumeric}
                  aria-sort={column.key === sortColumn.key ? sortOrder : "none"}
                  style={{ position: "relative" }}
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
                        {column.heading}
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
          {sortedDashboardLists.map((dashboardList) => {
            return (
              <Tr key={dashboardList.gene_symbol}>
                {columns.map((column) => {
                  return (
                    <Td
                      key={column.key}
                      fontWeight="normal"
                      isNumeric={column.isNumeric}
                    >
                      {column.render(dashboardList)}
                    </Td>
                  );
                })}
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
