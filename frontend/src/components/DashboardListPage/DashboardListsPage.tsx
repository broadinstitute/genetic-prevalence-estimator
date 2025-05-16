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
  FormControl,
  FormLabel,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Text,
} from "@chakra-ui/react";
import { sortBy } from "lodash";

import { FC, useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Link as RRLink } from "react-router-dom";
import { FixedSizeList } from "react-window";

import { del, get, postFile } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, atom, authStore, useStore } from "../../state";
import { VariantList } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DocumentTitle from "../DocumentTitle";

import {
  renderFrequencyFraction,
  calculateFrequencyFractionOver100000,
  renderFrequencyFractionOver100000,
} from "../VariantListPage/VariantListCalculations/calculationsDisplayFormats";

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
  variant_calculations: {
    carrier_frequency: number[];
    carrier_frequency_raw_numbers: number[];
    carrier_frequency_simplified: number[];
    prevalence: number[];
    prevalence_bayesian: number[];
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
    owners: string[];
  };
  dominant_dashboard_list?: {
    date_created: string;
    metadata: {
      gene_id: string;
      gene_symbol: string;
      transcript_id: string;
      gnomad_version: string;
    };
    de_novo_variant_calculations: {
      missense_de_novo_incidence: number;
      lof_de_novo_incidence: number;
      total_de_novo_incidence: number;
      inputs: {
        oe_mis_capped: number;
        mu_mis: number;
        oe_lof_capped: number;
        mu_lof: number;
        oe_mis_prior: number;
        oe_lof_prior: number;
      };
    };
    inheritance_type: string;
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
  headingTooltip?: string;
  isNumeric?: boolean;
  width: number;
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
    width: 200,
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
    key: "inheritance_type",
    heading: "Mode of Inheritance",
    width: 200,
    sortKey: (dashboardList) => {
      {
        console.log(dashboardList);
      }
      return dashboardList.inheritance_type;
    },
    render: (dashboardList) => {
      return <Cell maxWidth={130}>{dashboardList.inheritance_type}</Cell>;
    },
  },

  {
    key: "aggregate_allele_freq_lp_p",
    heading: "Aggregate allele frequency for LP/P variants",
    width: 200,
    sortKey: (dashboardList) => {
      const carrierFreq =
        dashboardList?.variant_calculations?.carrier_frequency;
      return carrierFreq && carrierFreq.length > 0
        ? Math.round(1 / (carrierFreq[0] / 2))
        : 0;
    },
    render: (dashboardList) => {
      const carrierFreq =
        dashboardList?.variant_calculations?.carrier_frequency;
      return carrierFreq && carrierFreq.length > 0 ? (
        <Cell maxWidth={130}>
          {renderFrequencyFraction(carrierFreq[0] / 2)}
        </Cell>
      ) : null;
    },
  },

  {
    key: "est_heterozygous_freq",
    heading: "Estimated heterozygous frequency (carrier frequency)",
    width: 200,

    sortKey: (dashboardList) => {
      const cf = dashboardList?.variant_calculations?.carrier_frequency?.[0];
      return cf && !isNaN(cf) && cf !== 0 ? Math.round(1 / cf) : 0;
    },

    render: (dashboardList) => {
      const cf = dashboardList?.variant_calculations?.carrier_frequency?.[0];
      const isValid = typeof cf === "number" && !isNaN(cf) && cf > 0;

      return isValid ? (
        <Cell maxWidth={130}>{renderFrequencyFraction(cf)}</Cell>
      ) : null;
    },
  },

  {
    key: "dashboard_estimate",
    heading:
      "Estimated biallelic frequency (Preliminary genetic prevalence) - AR ONLY",
    headingTooltip:
      "Preliminary genetic prevalence estimates are algorithmically generated using ClinVar pathogenic/likely pathogenic variants and gnomAD high confidence predicted loss-of-function variants only. These estimates have not been manually reviewed and may contain non-disease causing variants. Use with caution.",
    width: 200,
    sortKey: (dashboardList) => {
      const gp = dashboardList?.estimates?.genetic_prevalence?.[0];
      return gp && !isNaN(gp) && gp !== 0 ? Math.round(1 / gp) : 0;
    },
    render: (dashboardList) => {
      const gp = dashboardList?.estimates?.genetic_prevalence?.[0];
      const isValid = typeof gp === "number" && !isNaN(gp) && gp > 0;

      if (dashboardList?.inheritance_type === "AD") {
        return <Cell maxWidth={200}>N/A - Dominant disease</Cell>;
      }

      return isValid ? (
        <Cell maxWidth={200}>
          <Link as={RRLink} to={`/dashboard/${dashboardList.gene_id}`}>
            {renderFrequencyFraction(gp)}
          </Link>
        </Cell>
      ) : null;
    },
  },

  {
    key: "de_novo_dashboard_estimate",
    heading: "Estimated incidence of de novo variation (per 100,000)",
    // TODO: UPDATE TOOLTIPS
    headingTooltip: "Estimated incidence of de novo variation (per 100,000)",
    width: 200,
    sortKey: (dashboardList) => {
      const incidence =
        dashboardList.dominant_dashboard_list?.de_novo_variant_calculations
          ?.total_de_novo_incidence;

      return incidence ?? 0;
    },
    render: (dashboardList) => {
      const incidence =
        dashboardList.dominant_dashboard_list?.de_novo_variant_calculations
          ?.total_de_novo_incidence;

      if (incidence === undefined || incidence === null) return null;

      const per100k = (incidence * 100_000).toFixed(3);

      return (
        <Cell maxWidth={200}>
          <Link
            as={RRLink}
            to={`/dashboard-incidence/${dashboardList.gene_id}`}
          >
            {per100k}
          </Link>
        </Cell>
      );
    },
  },

  {
    key: "representative_estimate",
    heading: "Curated Estimates Public on GeniE",
    width: 200,
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
    width: 240,
    sortKey: (dashboardList) => {
      if (
        dashboardList.representative_variant_list &&
        dashboardList.representative_variant_list.owners
      ) {
        return dashboardList.representative_variant_list.owners[0] ? 1 : 0;
      }
      return 0;
    },
    render: (dashboardList) => {
      const ownersArray = dashboardList.representative_variant_list
        ? dashboardList.representative_variant_list.owners
        : [""];

      return (
        <Cell maxWidth={200}>
          <Tooltip hasArrow label={ownersArray[0]}>
            <Text color={"blue.700"}>
              {ownersArray[0].length > 15
                ? `${ownersArray[0].slice(0, 14)}...`
                : ownersArray[0]}
            </Text>
          </Tooltip>
        </Cell>
      );
    },
  },

  {
    key: "supporting_documents",
    heading: "Supporting document",
    width: 200,
    sortKey: (dashboardList) => {
      if (
        dashboardList.representative_variant_list &&
        dashboardList.representative_variant_list.supporting_documents
      ) {
        return dashboardList.representative_variant_list.supporting_documents[0]
          ? 1
          : 0;
      }
      return 0;
    },
    render: (dashboardList) => {
      return (
        <Cell maxWidth={200}>
          {dashboardList.representative_variant_list &&
            dashboardList.representative_variant_list.supporting_documents
              .length > 0 && (
              <Link
                href={
                  dashboardList.representative_variant_list
                    .supporting_documents[0].url
                }
                isExternal
                target="_blank"
              >
                {
                  dashboardList.representative_variant_list
                    .supporting_documents[0].title
                }
              </Link>
            )}
        </Cell>
      );
    },
  },

  {
    key: "prevalence_orphanet",
    heading: "Prevalence orphanet",
    width: 200,
    sortKey: (dashboardList) => {
      return dashboardList.genetic_prevalence_orphanet;
    },
    render: (dashboardList) => {
      const orphanetPrevalence = dashboardList.genetic_prevalence_orphanet;

      return (
        <Cell maxWidth={200}>
          <Link
            href={`https://www.orpha.net/en/disease/gene/${dashboardList.gene_symbol.toUpperCase()}?name=${dashboardList.gene_symbol.toLocaleLowerCase()}&mode=gene`}
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

const ROW_HEIGHT = 70;

const DataRow = ({
  index: dataRowIndex,
  data: { columns, data },
  style,
}: {
  index: number;
  data: {
    columns: ColumnDef[];
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
      {columns.map((column: ColumnDef, columnIndex: number) => {
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
      })}
    </Tr>
  );
};

const DashboardLists = (props: {
  dashboardListsStore: Store<DashboardList[]>;
}) => {
  const { dashboardListsStore } = props;
  const dashboardLists = useStore(dashboardListsStore);

  type Filter = {
    searchText: string;
  };
  const [filter, setFilter] = useState<Filter>({
    searchText: "",
  });

  const toast = useToast();
  const { user } = useStore(authStore);
  const userIsStaff = user?.is_staff ? true : false;

  const STAFF_COLUMNS: ColumnDef[] = [
    {
      key: "delete_dashboard_list",
      heading: "",
      width: 200,
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

  const filteredDashboardLists = useMemo(() => {
    return dashboardLists.filter((dashboardList: DashboardList) =>
      dashboardList.gene_symbol
        .toUpperCase()
        .includes(filter.searchText.toUpperCase())
    );
  }, [dashboardLists, filter]);

  const sortedDashboardLists = sortBy(filteredDashboardLists, (dashboardList) =>
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

  const loadDominantDashboardLists = (): Promise<void> => {
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

    return postFile(`/dominant-dashboard-lists/load`, formData).then(
      () => {
        toast({
          title: "Dominant Dashboard lists loaded!",
          status: "success",
          duration: 30_000,
          isClosable: true,
        });
        setFile(null);
      },
      (error) => {
        toast({
          title: "Unable to load dominant dashboard lists",
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

      <Table>
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
            itemCount={sortedDashboardLists.length}
            itemSize={ROW_HEIGHT}
            width={"100%"}
            overscanCount={5}
            itemData={{
              columns,
              data: sortedDashboardLists,
            }}
            style={{
              overflowX: "hidden",
            }}
          >
            {DataRow}
          </FixedSizeList>
        </Tbody>
      </Table>

      <Box mt={4}>
        <Link href="/dashboard-summary.csv" download>
          Download CSV
        </Link>
      </Box>

      {userIsStaff && (
        <Box mt={6}>
          <Accordion allowToggle>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    Upload dashboard lists from .csv file
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <Box mb={4}>
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    placeholder="Add a file populate lists"
                    size="md"
                    mb={2}
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
                </Box>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
          <Accordion allowToggle>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    Upload dominant dashboard lists from .csv file
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <Box mb={4}>
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    placeholder="Add a file populate lists"
                    size="md"
                    mb={2}
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
                      loadDominantDashboardLists();
                    }}
                  >
                    Load
                  </ButtonWithConfirmation>
                </Box>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Box>
      )}
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
      <DocumentTitle title="Dashboard" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>Dashboard</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Dashboard
      </Heading>

      <DashboardListContainer />
    </>
  );
};

export default DashboardListsPage;
