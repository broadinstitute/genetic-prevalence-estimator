import {
  Box,
  Button,
  Link,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VisuallyHidden,
} from "@chakra-ui/react";
import { ReactNode, useState } from "react";
import { Link as RRLink } from "react-router-dom";
import { FixedSizeList } from "react-window";

import { VariantListStatus } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";

export interface SystemStatusVariantList {
  uuid: string;
  label: string;
  status: VariantListStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  gene_symbol: string | null;
  gnomad_version: string | null;
}

export type VariantListSortKey = "status" | "created_at" | "updated_at";

export type SortDirection = "ascending" | "descending";

export interface VariantListSort {
  key: VariantListSortKey;
  direction: SortDirection;
}

export interface VariantListStatusColumn<
  VariantList extends SystemStatusVariantList
> {
  key: string;
  header: ReactNode;
  width: number;
  sortKey?: VariantListSortKey;
  title?: (variantList: VariantList) => string | undefined;
  renderCell: (variantList: VariantList) => ReactNode;
}

const ROW_HEIGHT = 50;
const ROWS_DISPLAYED = 10;

const STATUS_GLYPHS: { [key in VariantListStatus]: string } = {
  Queued: "○",
  Processing: "◐",
  Ready: "●",
  Error: "✕",
};

const SORT_DIRECTION_GLYPHS: { [key in SortDirection]: string } = {
  ascending: "▲",
  descending: "▼",
};

const compactDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

const formatCompactDateTime = (datetime: string) => {
  return compactDateTimeFormatter.format(new Date(datetime));
};

const cellStyle = (width: number) => {
  return {
    flex: `0 0 ${width}px`,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as const;
};

const sortVariantLists = <VariantList extends SystemStatusVariantList>(
  variantLists: VariantList[],
  sort: VariantListSort
) => {
  const directionMultiplier = sort.direction === "ascending" ? 1 : -1;
  return [...variantLists].sort((a, b) => {
    const comparison =
      a[sort.key].localeCompare(b[sort.key]) ||
      a.created_at.localeCompare(b.created_at);
    return comparison * directionMultiplier;
  });
};

export const labelColumn: VariantListStatusColumn<SystemStatusVariantList> = {
  key: "label",
  header: "List label",
  width: 260,
  title: (variantList) => variantList.label,
  renderCell: (variantList) => {
    return (
      <Link as={RRLink} to={`/variant-lists/${variantList.uuid}`}>
        {variantList.label}
      </Link>
    );
  },
};

export const statusColumn: VariantListStatusColumn<SystemStatusVariantList> = {
  key: "status",
  header: "Status",
  width: 150,
  sortKey: "status",
  renderCell: (variantList) => {
    return `${STATUS_GLYPHS[variantList.status]} ${variantList.status}`;
  },
};

export const createdByColumn: VariantListStatusColumn<SystemStatusVariantList> = {
  key: "created_by",
  header: "Created by",
  width: 260,
  title: (variantList) => variantList.created_by ?? undefined,
  renderCell: (variantList) => variantList.created_by ?? "Unknown",
};

export const geneSymbolColumn: VariantListStatusColumn<SystemStatusVariantList> = {
  key: "gene_symbol",
  header: "Gene",
  width: 110,
  renderCell: (variantList) => variantList.gene_symbol ?? "",
};

export const gnomadVersionColumn: VariantListStatusColumn<SystemStatusVariantList> = {
  key: "gnomad_version",
  header: "gnomAD",
  width: 110,
  renderCell: (variantList) => variantList.gnomad_version ?? "",
};

export const createdAtColumn: VariantListStatusColumn<SystemStatusVariantList> = {
  key: "created_at",
  header: "Created",
  width: 210,
  sortKey: "created_at",
  renderCell: (variantList) => formatCompactDateTime(variantList.created_at),
};

export const updatedAtColumn: VariantListStatusColumn<SystemStatusVariantList> = {
  key: "updated_at",
  header: "Last updated",
  width: 210,
  sortKey: "updated_at",
  renderCell: (variantList) => formatCompactDateTime(variantList.updated_at),
};

export const retryColumn = (
  onRetry: (variantList: SystemStatusVariantList) => void
): VariantListStatusColumn<SystemStatusVariantList> => {
  return {
    key: "retry",
    header: <VisuallyHidden>Actions</VisuallyHidden>,
    width: 120,
    renderCell: (variantList) => {
      return (
        <ButtonWithConfirmation
          size="sm"
          colorScheme="blue"
          confirmationPrompt={`Re-queue "${variantList.label}"? If it is still being processed, it will be processed twice.`}
          confirmButtonText="Retry"
          confirmButtonColorScheme="blue"
          onClick={() => {
            onRetry(variantList);
          }}
        >
          Retry
        </ButtonWithConfirmation>
      );
    },
  };
};

const SortableColumnHeader = ({
  header,
  sortKey,
  sort,
  onSort,
  width,
}: {
  header: ReactNode;
  sortKey: VariantListSortKey;
  sort: VariantListSort;
  onSort: (sortKey: VariantListSortKey) => void;
  width: number;
}) => {
  const isSorted = sort.key === sortKey;
  const ariaSort = isSorted ? sort.direction : "none";
  const glyph = isSorted ? SORT_DIRECTION_GLYPHS[sort.direction] : "↕";

  return (
    <Th scope="col" aria-sort={ariaSort} sx={cellStyle(width)}>
      <Button
        variant="unstyled"
        height="auto"
        minWidth={0}
        fontSize="inherit"
        fontWeight="inherit"
        letterSpacing="inherit"
        textTransform="inherit"
        onClick={() => {
          onSort(sortKey);
        }}
      >
        {header} {glyph}
      </Button>
    </Th>
  );
};

interface VariantListStatusRowData<
  VariantList extends SystemStatusVariantList
> {
  variantLists: VariantList[];
  columns: VariantListStatusColumn<VariantList>[];
}

const VariantListStatusRow = <VariantList extends SystemStatusVariantList>({
  index,
  data,
  style,
}: {
  index: number;
  data: VariantListStatusRowData<VariantList>;
  style: React.CSSProperties;
}) => {
  const variantList = data.variantLists[index];

  return (
    <Tr
      sx={{
        display: "flex",
        alignItems: "center",
        boxSizing: "border-box",
        background: index % 2 === 1 ? "initial" : "#edf2f7",
      }}
      style={style}
    >
      {data.columns.map((column) => {
        return (
          <Td
            key={column.key}
            sx={cellStyle(column.width)}
            title={column.title?.(variantList)}
          >
            {column.renderCell(variantList)}
          </Td>
        );
      })}
    </Tr>
  );
};

const VariantListStatusTable = <VariantList extends SystemStatusVariantList>({
  variantLists,
  columns,
  defaultSort,
  emptyMessage,
}: {
  variantLists: VariantList[];
  columns: VariantListStatusColumn<VariantList>[];
  defaultSort: VariantListSort;
  emptyMessage: string;
}) => {
  const [sort, setSort] = useState<VariantListSort>(defaultSort);

  const toggleSort = (sortKey: VariantListSortKey) => {
    setSort((currentSort) => {
      if (currentSort.key !== sortKey) {
        return { key: sortKey, direction: "ascending" };
      }
      const direction =
        currentSort.direction === "ascending" ? "descending" : "ascending";
      return { key: sortKey, direction };
    });
  };

  if (variantLists.length === 0) {
    return <Text mt={4}>{emptyMessage}</Text>;
  }

  const sortedVariantLists = sortVariantLists(variantLists, sort);
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);

  return (
    <Box overflowX="auto" mt={4}>
      <Table variant="unstyled" width={`${tableWidth}px`}>
        <Thead>
          <Tr sx={{ display: "flex" }}>
            {columns.map((column) => {
              if (column.sortKey) {
                return (
                  <SortableColumnHeader
                    key={column.key}
                    header={column.header}
                    sortKey={column.sortKey}
                    sort={sort}
                    onSort={toggleSort}
                    width={column.width}
                  />
                );
              }
              return (
                <Th key={column.key} scope="col" sx={cellStyle(column.width)}>
                  {column.header}
                </Th>
              );
            })}
          </Tr>
        </Thead>
        <Tbody>
          <FixedSizeList<VariantListStatusRowData<VariantList>>
            height={Math.min(variantLists.length, ROWS_DISPLAYED) * ROW_HEIGHT}
            itemCount={variantLists.length}
            itemSize={ROW_HEIGHT}
            width={tableWidth}
            overscanCount={5}
            itemData={{ variantLists: sortedVariantLists, columns }}
            style={{ overflowX: "hidden" }}
          >
            {VariantListStatusRow}
          </FixedSizeList>
        </Tbody>
      </Table>
    </Box>
  );
};

export default VariantListStatusTable;
