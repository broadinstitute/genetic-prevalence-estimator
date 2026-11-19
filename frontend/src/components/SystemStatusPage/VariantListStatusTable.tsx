import { Link, VisuallyHidden } from "@chakra-ui/react";
import { Link as RRLink } from "react-router-dom";

import { VariantListStatus } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import formatCompactDateTime from "../formatCompactDateTime";
import VirtualizedTable, {
  TableSort,
  VirtualizedTableColumn,
} from "../VirtualizedTable";

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

export type VariantListSort = TableSort<VariantListSortKey>;

export type VariantListStatusColumn<
  VariantList extends SystemStatusVariantList
> = VirtualizedTableColumn<VariantList, VariantListSortKey>;

const STATUS_GLYPHS: { [key in VariantListStatus]: string } = {
  Queued: "○",
  Processing: "◐",
  Ready: "●",
  Error: "✕",
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

const getVariantListSortValue = (
  variantList: SystemStatusVariantList,
  sortKey: VariantListSortKey
) => {
  return variantList[sortKey];
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
  return (
    <VirtualizedTable
      rows={variantLists}
      columns={columns}
      defaultSort={defaultSort}
      getSortValue={getVariantListSortValue}
      tieBreakSortKey="created_at"
      emptyMessage={emptyMessage}
    />
  );
};

export default VariantListStatusTable;
