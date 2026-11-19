import {
  Box,
  Button,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { ReactNode, useState } from "react";
import { FixedSizeList } from "react-window";

export type SortDirection = "ascending" | "descending";

export interface TableSort<SortKey extends string> {
  key: SortKey;
  direction: SortDirection;
}

export interface VirtualizedTableColumn<Row, SortKey extends string> {
  key: string;
  header: ReactNode;
  width: number;
  sortKey?: SortKey;
  title?: (row: Row) => string | undefined;
  renderCell: (row: Row) => ReactNode;
}

const ROW_HEIGHT = 50;
const ROWS_DISPLAYED = 10;

const SORT_DIRECTION_GLYPHS: { [key in SortDirection]: string } = {
  ascending: "▲",
  descending: "▼",
};

const cellStyle = (width: number) => {
  return {
    flex: `0 0 ${width}px`,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as const;
};

const compareSortValues = (a: string | null, b: string | null) => {
  if (a === null || b === null) {
    return 0;
  }
  return a.localeCompare(b);
};

const sortRows = <Row, SortKey extends string>(
  rows: Row[],
  sort: TableSort<SortKey>,
  getSortValue: (row: Row, sortKey: SortKey) => string | null,
  tieBreakSortKey: SortKey
) => {
  const directionMultiplier = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aValue = getSortValue(a, sort.key);
    const bValue = getSortValue(b, sort.key);
    if (aValue === null || bValue === null) {
      return Number(aValue === null) - Number(bValue === null);
    }
    const comparison =
      compareSortValues(aValue, bValue) ||
      compareSortValues(
        getSortValue(a, tieBreakSortKey),
        getSortValue(b, tieBreakSortKey)
      );
    return comparison * directionMultiplier;
  });
};

const SortableColumnHeader = <SortKey extends string>({
  header,
  sortKey,
  sort,
  onSort,
  width,
}: {
  header: ReactNode;
  sortKey: SortKey;
  sort: TableSort<SortKey>;
  onSort: (sortKey: SortKey) => void;
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

interface VirtualizedTableRowData<Row, SortKey extends string> {
  rows: Row[];
  columns: VirtualizedTableColumn<Row, SortKey>[];
}

const VirtualizedTableRow = <Row, SortKey extends string>({
  index,
  data,
  style,
}: {
  index: number;
  data: VirtualizedTableRowData<Row, SortKey>;
  style: React.CSSProperties;
}) => {
  const row = data.rows[index];

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
            title={column.title?.(row)}
          >
            {column.renderCell(row)}
          </Td>
        );
      })}
    </Tr>
  );
};

const VirtualizedTable = <Row, SortKey extends string>({
  rows,
  columns,
  defaultSort,
  getSortValue,
  tieBreakSortKey,
  emptyMessage,
}: {
  rows: Row[];
  columns: VirtualizedTableColumn<Row, SortKey>[];
  defaultSort: TableSort<SortKey>;
  getSortValue: (row: Row, sortKey: SortKey) => string | null;
  tieBreakSortKey: SortKey;
  emptyMessage: string;
}) => {
  const [sort, setSort] = useState<TableSort<SortKey>>(defaultSort);

  const toggleSort = (sortKey: SortKey) => {
    setSort((currentSort) => {
      if (currentSort.key !== sortKey) {
        return { key: sortKey, direction: "ascending" };
      }
      const direction =
        currentSort.direction === "ascending" ? "descending" : "ascending";
      return { key: sortKey, direction };
    });
  };

  if (rows.length === 0) {
    return <Text mt={4}>{emptyMessage}</Text>;
  }

  const sortedRows = sortRows(rows, sort, getSortValue, tieBreakSortKey);
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
          <FixedSizeList<VirtualizedTableRowData<Row, SortKey>>
            height={Math.min(rows.length, ROWS_DISPLAYED) * ROW_HEIGHT}
            itemCount={rows.length}
            itemSize={ROW_HEIGHT}
            width={tableWidth}
            overscanCount={5}
            itemData={{ rows: sortedRows, columns }}
            style={{ overflowX: "hidden" }}
          >
            {VirtualizedTableRow}
          </FixedSizeList>
        </Tbody>
      </Table>
    </Box>
  );
};

export default VirtualizedTable;
