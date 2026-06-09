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

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DocumentTitle from "../DocumentTitle";

import { renderFrequencyFraction } from "../VariantListPage/VariantListCalculations/calculationsDisplayFormats";

type DashboardList = {
  gene_id: string;
  gene_symbol: string;
  inheritance_type: string;

  genetic_prevalence_orphanet: string;

  aggregate_allele_frequency: number;
  estimated_genetic_prevalence: number;
  estimated_de_novo_incidence: number;

  representative_variant_list: {
    uuid: string;
    label: string;
    supporting_documents: any[];
    total_genetic_prevalence: number;
    owners: string[];
  };
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

const CHIP_GENE_SYMBOLS = [
  "ARID1A",
  "ASXL1",
  "ASXL2",
  "BCL10",
  "BCL11B",
  "BCL6",
  "BCOR",
  "BCORL1",
  "BIRC3",
  "BRAF",
  "BRCC3",
  "BTG1",
  "BTG2",
  "CARD11",
  "CBL",
  "CBLB",
  "CCND3",
  "CD58",
  "CD70",
  "CD79A",
  "CD79B",
  "CDKN2A",
  "CDKN2B",
  "CEBPA",
  "CHD2",
  "CNOT3",
  "CREBBP",
  "CRLF2",
  "CSF1R",
  "CSF3R",
  "CTCF",
  "CUX1",
  "DDX3X",
  "DIS3",
  "DNMT3A",
  "EBF1",
  "EED",
  "EP300",
  "ETV6",
  "EZH2",
  "EZR",
  "FAM46C",
  "FAS",
  "FBXO11",
  "FBXW7",
  "FLT3",
  "FOXP1",
  "FYN",
  "GATA1",
  "GATA2",
  "GATA3",
  "GNA13",
  "GNAS",
  "GNB1",
  "HIST1H1B",
  "HIST1H1C",
  "HIST1H1D",
  "HIST1H1E",
  "HIST1H3B",
  "HLAVA",
  "ID3",
  "IDH1",
  "IDH2",
  "IKBKB",
  "IKZF1",
  "IKZF2",
  "IKZF3",
  "IL7R",
  "INTS12",
  "IRF4",
  "IRF8",
  "JAK1",
  "JAK2",
  "JAK3",
  "JARID2",
  "KDM6A",
  "KIT",
  "KLHL6",
  "KMT2A",
  "KMT2D",
  "KRAS",
  "LEF1",
  "LRRK2",
  "LTB",
  "LUC7L2",
  "MALT1",
  "MAP2K1",
  "MAP3K14",
  "MED12",
  "MEF2B",
  "MLL",
  "MLL2",
  "MPL",
  "MXRA5",
  "MYD88",
  "NF1",
  "NOTCH1",
  "NOTCH2",
  "NPM1",
  "NRAS",
  "P2RY8",
  "PAPD5",
  "PAX5",
  "PDS5B",
  "PDSS2",
  "PHF6",
  "PHIP",
  "PIK3CA",
  "POT1",
  "POU2AF1",
  "POU2F2",
  "PPM1D",
  "PRDM1",
  "PRPF40B",
  "PRPF8",
  "PTEN",
  "PTPN1",
  "PTPN11",
  "RAD21",
  "RBBP4",
  "RHOA",
  "RIT1",
  "RPL10",
  "RPL5",
  "RPS15",
  "RPS2",
  "RUNX1",
  "SETD2",
  "SF3A1",
  "SF3B1",
  "SFRS2",
  "SGK1",
  "SMC1A",
  "SMC3",
  "SOCS1",
  "SPRY4",
  "STAG1",
  "STAG2",
  "STAT3",
  "STAT5A",
  "STAT5B",
  "STAT6",
  "SUZ12",
  "SUZ12",
  "SWAP70",
  "TBL1XR1",
  "TCF3",
  "TET1",
  "TET2",
];

const ChipGeneFlag = () => {
  return (
    <Tooltip
      hasArrow
      label="This is a known clonal hematopoiesis of indeterminate potential (CHIP) gene"
    >
      <Badge colorScheme="yellow" fontSize="0.8em" ml={2} style={{ order: -1 }}>
        H
      </Badge>
    </Tooltip>
  );
};

const CES_GENE_SYMBOLS = [
  "ANKRD11",
  "ARHGAP35",
  "ARID1A",
  "ARID1B",
  "BCAS3",
  "BCL9",
  "BMPR2",
  "BRAF",
  "CBL",
  "CCAR2",
  "CDK13",
  "CERT1",
  "CSNK2A1",
  "CSNK2B",
  "CTBP1",
  "CTNNB1",
  "CUL3",
  "DHX9",
  "DYRK1B",
  "EP300",
  "FAM222B",
  "FAT1",
  "FGFR2",
  "FGFR3",
  "FOXG1",
  "G3BP1",
  "GNB1",
  "GRIN2B",
  "HRAS",
  "KDM5B",
  "KMT2E",
  "KRAS",
  "LZTR1",
  "MAP2K1",
  "MAP2K2",
  "MIB1",
  "MTOR",
  "NARS1",
  "NF1",
  "NSD1",
  "PACS1",
  "PACS2",
  "PIWIL1",
  "PPM1D",
  "PPP1CB",
  "PPP2R5D",
  "PRRC2A",
  "PSMC5",
  "PTEN",
  "PTPN11",
  "PURA",
  "RAF1",
  "RASA2",
  "RBM12",
  "RET",
  "RIT1",
  "ROBO1",
  "SALL3",
  "SCAF4",
  "SEMG1",
  "SHOC2",
  "SKI",
  "SMAD4",
  "SMAD6",
  "SOS1",
  "SPRY2",
  "TCF12",
  "TCF7L2",
  "TNPO3",
  "TRERF1",
  "ZMYM2",
];

const CesGeneFlag = () => {
  return (
    <Tooltip
      hasArrow
      label="This is a known clonal expansion spermatogonia (CES) gene"
    >
      <Badge colorScheme="yellow" fontSize="0.8em" ml={2} style={{ order: -1 }}>
        C
      </Badge>
    </Tooltip>
  );
};

export const Cell: FC<{ maxWidth: number }> = ({ children, maxWidth }) => {
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

export interface ColumnDef {
  key: string;
  heading: string;
  headingTooltip?: string;
  isNumeric?: boolean;
  width: number;
  sortKey?: (rowData: any) => string | number | (string | number)[];
  render: (
    rowData: any
  ) =>
    | JSX.Element
    | string
    | (JSX.Element | string)[]
    | null
    | undefined
    | false;
}

const getBaseColumns = (userIsStaff: boolean): ColumnDef[] => {
  const columns: ColumnDef[] = [
    {
      key: "gene_symbol",
      heading: "Gene Symbol",
      width: 175,
      sortKey: (dashboardList) => {
        return dashboardList.gene_symbol;
      },
      render: (dashboardList) => {
        return (
          <Cell maxWidth={130}>
            {dashboardList.gene_symbol}
            {CES_GENE_SYMBOLS.indexOf(dashboardList.gene_symbol) !== -1 && (
              <CesGeneFlag />
            )}
            {CHIP_GENE_SYMBOLS.indexOf(dashboardList.gene_symbol) !== -1 && (
              <ChipGeneFlag />
            )}
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
      width: 120,
      sortKey: (dashboardList: DashboardList) => {
        return dashboardList.inheritance_type;
      },
      render: (dashboardList: DashboardList) => {
        return <Cell maxWidth={130}>{dashboardList.inheritance_type}</Cell>;
      },
    },

    {
      key: "aggregate_allele_freq_lp_p",
      heading: "Aggregate allele frequency for LP/P variants",
      width: 175,
      sortKey: (dashboardList: DashboardList) => {
        return 1 / dashboardList.aggregate_allele_frequency;
      },
      render: (dashboardList: DashboardList) => {
        return dashboardList.aggregate_allele_frequency ? (
          <Cell maxWidth={130}>
            {renderFrequencyFraction(dashboardList.aggregate_allele_frequency)}
          </Cell>
        ) : null;
      },
    },

    {
      key: "est_heterozygous_freq",
      heading: "Estimated heterozygous frequency (carrier frequency)",
      width: 175,

      sortKey: (dashboardList: DashboardList) => {
        const aggregate_allele_frequency =
          dashboardList.aggregate_allele_frequency;
        const heterozygous_frequency = aggregate_allele_frequency
          ? aggregate_allele_frequency * 2
          : null;
        return heterozygous_frequency ? 1 / heterozygous_frequency : 0;
      },

      render: (dashboardList: DashboardList) => {
        const aggregate_allele_frequency =
          dashboardList.aggregate_allele_frequency;
        const heterozygous_frequency = aggregate_allele_frequency
          ? aggregate_allele_frequency * 2
          : null;

        return heterozygous_frequency ? (
          <Cell maxWidth={130}>
            {renderFrequencyFraction(heterozygous_frequency)}
          </Cell>
        ) : null;
      },
    },
    {
      key: "dashboard_estimate",
      heading:
        "Estimated biallelic frequency (Preliminary genetic prevalence) - AR ONLY",
      headingTooltip:
        "Preliminary genetic prevalence estimates are algorithmically generated using ClinVar pathogenic/likely pathogenic variants and gnomAD high confidence predicted loss-of-function variants only. These estimates have not been manually reviewed and may contain non-disease causing variants. Use with caution.",
      width: 175,
      sortKey: (dashboardList: DashboardList) => {
        return dashboardList.estimated_genetic_prevalence
          ? 1 / dashboardList.estimated_genetic_prevalence
          : 0;
      },
      render: (dashboardList: DashboardList) => {
        const estimated_genetic_prevalence =
          dashboardList.estimated_genetic_prevalence;

        if (dashboardList.inheritance_type === "AD") {
          return <Cell maxWidth={200}> - </Cell>;
        }

        return (
          <Cell maxWidth={200}>
            <Link as={RRLink} to={`/dashboard/${dashboardList.gene_id}`}>
              {renderFrequencyFraction(estimated_genetic_prevalence)}
            </Link>
          </Cell>
        );
      },
    },
  ];

  if (userIsStaff) {
    columns.push({
      key: "de_novo_dashboard_estimate",
      heading: "Estimated incidence of de novo variation (per 100,000)",
      headingTooltip: "Estimated incidence of de novo variation (per 100,000)",
      width: 175,
      sortKey: (dashboardList: DashboardList) => {
        return dashboardList.estimated_de_novo_incidence;
      },
      render: (dashboardList: DashboardList) => {
        const incidencePer100k = (
          dashboardList.estimated_de_novo_incidence * 100_000
        ).toFixed(3);

        return (
          <Cell maxWidth={200}>
            <Link
              as={RRLink}
              to={`/dashboard-incidence/${dashboardList.gene_id}`}
            >
              {incidencePer100k}
            </Link>
          </Cell>
        );
      },
    });
  }

  columns.push(
    {
      key: "representative_estimate",
      heading: "Curated Estimates Public on GeniE",
      width: 150,
      sortKey: (dashboardList: DashboardList) => {
        if (dashboardList.representative_variant_list) {
          const genetic_prevalence =
            dashboardList.representative_variant_list.total_genetic_prevalence;
          return genetic_prevalence !== 0
            ? Math.round(1 / genetic_prevalence)
            : 0;
        }
        return 0;
      },
      render: (dashboardList: DashboardList) => {
        return (
          <Cell maxWidth={200}>
            {dashboardList.representative_variant_list && (
              <Link
                as={RRLink}
                to={`/variant-lists/${dashboardList.representative_variant_list.uuid}`}
              >
                {renderFrequencyFraction(
                  dashboardList.representative_variant_list
                    .total_genetic_prevalence
                )}
              </Link>
            )}
            {!dashboardList.representative_variant_list && null}
          </Cell>
        );
      },
    },

    {
      key: "representative_contact",
      heading: "Contact for public estimate",
      width: 150,
      sortKey: (dashboardList: DashboardList) => {
        if (
          dashboardList.representative_variant_list &&
          dashboardList.representative_variant_list.owners &&
          Array.isArray(dashboardList.representative_variant_list.owners) &&
          dashboardList.representative_variant_list.owners.length > 0
        ) {
          return dashboardList.representative_variant_list.owners[0] ? 1 : 0;
        }
        return 0;
      },
      render: (dashboardList) => {
        const ownersArray =
          dashboardList.representative_variant_list &&
          dashboardList.representative_variant_list.owners &&
          Array.isArray(dashboardList.representative_variant_list.owners) &&
          dashboardList.representative_variant_list.owners.length > 0
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
      width: 150,
      sortKey: (dashboardList) => {
        if (
          dashboardList.representative_variant_list &&
          dashboardList.representative_variant_list.supporting_documents
        ) {
          return dashboardList.representative_variant_list
            .supporting_documents[0]
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
    }
  );
  return columns;
};

type SortOrder = "ascending" | "descending";
interface SortState {
  key: string;
  order: SortOrder;
}

export const useSort = (
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
  handleRefresh: () => Promise<void>;
}) => {
  const { dashboardListsStore, handleRefresh } = props;
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
    ...getBaseColumns(userIsStaff),
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
        <>
          <ButtonWithConfirmation
            mt="6"
            size="sm"
            colorScheme="blue"
            confirmationPrompt="This will clear the cache, and cause a reload."
            confirmButtonText="Refresh"
            onClick={() => {
              handleRefresh();
            }}
          >
            Refresh dashboard
          </ButtonWithConfirmation>

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
        </>
      )}
    </>
  );
};

const DashboardListContainer = () => {
  const dashboardListStoreRef = useRef<Store<DashboardList[]>>(
    atom<DashboardList[]>([])
  );

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsInitialLoading(true);
    } else {
      setIsInitialLoading(true);
    }

    try {
      const url = forceRefresh
        ? "/dashboard-lists/?refresh=true"
        : "/dashboard-lists/";

      const dashboardLists = await get(url);
      dashboardListStoreRef.current.set(dashboardLists);

      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  const handleRefresh = async () => {
    await fetchDashboardData(true);
  };

  if (isInitialLoading) {
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

  return (
    <DashboardLists
      dashboardListsStore={dashboardListStoreRef.current}
      handleRefresh={handleRefresh}
    />
  );
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
