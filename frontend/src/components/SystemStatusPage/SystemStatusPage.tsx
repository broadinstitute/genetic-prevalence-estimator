import { ViewIcon } from "@chakra-ui/icons";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Checkbox,
  Center,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get } from "../../api";

import DocumentTitle from "../DocumentTitle";
import { reprocessVariantList } from "../VariantListPage/VariantListStatus";

import VariantListStatusTable, {
  createdAtColumn,
  createdByColumn,
  geneSymbolColumn,
  gnomadVersionColumn,
  labelColumn,
  retryColumn,
  statusColumn,
  SystemStatusVariantList,
  updatedAtColumn,
  VariantListSort,
  VariantListStatusColumn,
} from "./VariantListStatusTable";
import VariantListCounts, {
  VariantListCountsData,
  VariantListCountThresholds,
} from "./VariantListCounts";

interface SystemStatusErroredVariantList extends SystemStatusVariantList {
  error: string;
}

export type VariantListBucket = "active" | "stuck" | "abandoned";

interface SystemStatusQueuedOrProcessingVariantList
  extends SystemStatusVariantList {
  bucket: VariantListBucket;
}

interface SystemStatus {
  counts: VariantListCountsData;
  thresholds: VariantListCountThresholds;
  error_details: SystemStatusErroredVariantList[];
  queued_and_processing_lists: SystemStatusQueuedOrProcessingVariantList[];
}

interface SystemStatusViewProps {
  systemStatus: SystemStatus;
  refreshSystemStatus: () => void;
}

const ERRORS_TAB_INDEX = 0;
const QUEUED_OR_PROCESSING_TAB_INDEX = 1;

const ERRORS_DEFAULT_SORT: VariantListSort = {
  key: "updated_at",
  direction: "descending",
};

const QUEUED_OR_PROCESSING_DEFAULT_SORT: VariantListSort = {
  key: "updated_at",
  direction: "descending",
};

const BUCKET_LABELS: { [key in VariantListBucket]: string } = {
  active: "Active",
  stuck: "⚠ Stuck",
  abandoned: "Abandoned",
};

const bucketColumn: VariantListStatusColumn<SystemStatusQueuedOrProcessingVariantList> = {
  key: "bucket",
  header: "Bucket",
  width: 140,
  renderCell: (variantList) => BUCKET_LABELS[variantList.bucket],
};

const DAY_MS = 24 * 60 * 60 * 1000;

const wasUpdatedWithinDays = (
  variantList: SystemStatusVariantList,
  days: number
) => {
  return (
    Date.now() - new Date(variantList.updated_at).getTime() < days * DAY_MS
  );
};

const summarizeError = (error: string) => {
  const lines = error.split("\n").filter((line) => line.trim() !== "");
  return lines[lines.length - 1]?.trim() ?? "";
};

const groupErrorsByCause = (
  erroredVariantLists: SystemStatusErroredVariantList[]
) => {
  const countsByCause = new Map<string, number>();
  erroredVariantLists.forEach((variantList) => {
    const cause = summarizeError(variantList.error) || "No error details";
    countsByCause.set(cause, (countsByCause.get(cause) ?? 0) + 1);
  });
  return Array.from(countsByCause, ([cause, count]) => ({ cause, count })).sort(
    (a, b) => b.count - a.count
  );
};

const RecentErrorCauses = ({
  erroredVariantLists,
  recentDays,
}: {
  erroredVariantLists: SystemStatusErroredVariantList[];
  recentDays: number;
}) => {
  if (erroredVariantLists.length === 0) {
    return null;
  }

  const errorCauses = groupErrorsByCause(erroredVariantLists);

  return (
    <Box mb={6}>
      <Heading as="h3" size="sm" mb={2}>
        Causes in the last {recentDays} days
      </Heading>
      <Table size="sm" maxWidth="900px">
        <Thead>
          <Tr>
            <Th scope="col">Cause</Th>
            <Th scope="col" isNumeric>
              Lists
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {errorCauses.map(({ cause, count }) => {
            return (
              <Tr key={cause}>
                <Td fontFamily="mono" sx={{ overflowWrap: "anywhere" }}>
                  {cause}
                </Td>
                <Td isNumeric>{count}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Box>
  );
};

const errorColumn = (
  onViewError: (variantList: SystemStatusErroredVariantList) => void
): VariantListStatusColumn<SystemStatusErroredVariantList> => {
  return {
    key: "error",
    header: "Error",
    width: 360,
    title: (variantList) => summarizeError(variantList.error),
    renderCell: (variantList) => {
      if (!variantList.error) {
        return "No error details";
      }
      return (
        <Button
          variant="link"
          colorScheme="blue"
          rightIcon={<ViewIcon />}
          textDecoration="underline"
          maxWidth="100%"
          aria-label={`View full error for ${variantList.label}`}
          onClick={() => {
            onViewError(variantList);
          }}
        >
          <Text as="span" isTruncated>
            {summarizeError(variantList.error)}
          </Text>
        </Button>
      );
    },
  };
};

const SystemStatusErrorModal = ({
  systemStatusError,
  onClose,
}: {
  systemStatusError: SystemStatusErroredVariantList | null;
  onClose: () => void;
}) => {
  return (
    <Modal
      isOpen={systemStatusError !== null}
      size="4xl"
      scrollBehavior="inside"
      onClose={onClose}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Error for {systemStatusError?.label}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Box
            as="pre"
            fontFamily="mono"
            fontSize="sm"
            m={0}
            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {systemStatusError?.error}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const SystemStatusView = (props: SystemStatusViewProps) => {
  const { systemStatus, refreshSystemStatus } = props;
  const toast = useToast();
  const [
    selectedErroredVariantList,
    setSelectedErroredVariantList,
  ] = useState<SystemStatusErroredVariantList | null>(null);

  const [tabIndex, setTabIndex] = useState(ERRORS_TAB_INDEX);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [showAbandonedLists, setShowAbandonedLists] = useState(false);

  const recentDays = systemStatus.thresholds.recent_days;
  const allErroredVariantLists = systemStatus.error_details;
  const recentErroredVariantLists = allErroredVariantLists.filter(
    (variantList) => wasUpdatedWithinDays(variantList, recentDays)
  );
  const shownErroredVariantLists = showAllErrors
    ? allErroredVariantLists
    : recentErroredVariantLists;

  const allQueuedOrProcessingVariantLists =
    systemStatus.queued_and_processing_lists;
  const unabandonedVariantLists = allQueuedOrProcessingVariantLists.filter(
    (variantList) => variantList.bucket !== "abandoned"
  );
  const shownQueuedOrProcessingVariantLists = showAbandonedLists
    ? allQueuedOrProcessingVariantLists
    : unabandonedVariantLists;

  const allErroredEmptyMessage = "No variant lists have errors.";
  const recentErroredEmptyMessage = `No variant lists errored in the last ${recentDays} days.`;
  const erroredEmptyMessage = showAllErrors
    ? allErroredEmptyMessage
    : recentErroredEmptyMessage;

  const allQueuedOrProcessingEmptyMessage =
    "No variant lists are queued or processing.";
  const unabandonedEmptyMessage =
    "No active or stuck variant lists. Abandoned lists are hidden.";
  const queuedOrProcessingEmptyMessage = showAbandonedLists
    ? allQueuedOrProcessingEmptyMessage
    : unabandonedEmptyMessage;

  const retryVariantList = (variantList: SystemStatusVariantList) => {
    reprocessVariantList(variantList.uuid).then(
      () => {
        toast({
          title: `Re-queued "${variantList.label}"`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        refreshSystemStatus();
      },
      (error: Error) => {
        toast({
          title: `Unable to re-queue "${variantList.label}"`,
          description: error.message,
          status: "error",
          duration: 10000,
          isClosable: true,
        });
      }
    );
  };

  return (
    <>
      <VariantListCounts
        counts={systemStatus.counts}
        thresholds={systemStatus.thresholds}
        onViewStuckLists={() => {
          setTabIndex(QUEUED_OR_PROCESSING_TAB_INDEX);
        }}
      />
      <Tabs isLazy mt={12} index={tabIndex} onChange={setTabIndex}>
        <TabList>
          <Tab>Errors ({shownErroredVariantLists.length})</Tab>
          <Tab>
            {`Queued and processing (${shownQueuedOrProcessingVariantLists.length})`}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <RecentErrorCauses
              erroredVariantLists={recentErroredVariantLists}
              recentDays={recentDays}
            />
            <Checkbox
              isChecked={showAllErrors}
              onChange={(event) => {
                setShowAllErrors(event.target.checked);
              }}
            >
              {`Show all ${allErroredVariantLists.length} errored lists, not just those updated in the last ${recentDays} days`}
            </Checkbox>
            <VariantListStatusTable
              variantLists={shownErroredVariantLists}
              columns={[
                labelColumn,
                createdByColumn,
                geneSymbolColumn,
                gnomadVersionColumn,
                createdAtColumn,
                updatedAtColumn,
                errorColumn(setSelectedErroredVariantList),
                retryColumn(retryVariantList),
              ]}
              defaultSort={ERRORS_DEFAULT_SORT}
              emptyMessage={erroredEmptyMessage}
            />
          </TabPanel>
          <TabPanel px={0}>
            <Checkbox
              isChecked={showAbandonedLists}
              onChange={(event) => {
                setShowAbandonedLists(event.target.checked);
              }}
            >
              {`Show ${
                allQueuedOrProcessingVariantLists.length -
                unabandonedVariantLists.length
              } abandoned lists, not updated in ${
                systemStatus.thresholds.abandoned_after_days
              } days`}
            </Checkbox>
            <VariantListStatusTable
              variantLists={shownQueuedOrProcessingVariantLists}
              columns={[
                labelColumn,
                statusColumn,
                bucketColumn,
                createdByColumn,
                geneSymbolColumn,
                gnomadVersionColumn,
                createdAtColumn,
                updatedAtColumn,
                retryColumn(retryVariantList),
              ]}
              defaultSort={QUEUED_OR_PROCESSING_DEFAULT_SORT}
              emptyMessage={queuedOrProcessingEmptyMessage}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <SystemStatusErrorModal
        systemStatusError={selectedErroredVariantList}
        onClose={() => {
          setSelectedErroredVariantList(null);
        }}
      />
    </>
  );
};

const SystemStatusContainer = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSystemStatus = useCallback(() => {
    return get("/status/").then(setSystemStatus, setError);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadSystemStatus().finally(() => {
      setIsLoading(false);
    });
  }, [loadSystemStatus]);

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

  return (
    <SystemStatusView
      systemStatus={systemStatus!}
      refreshSystemStatus={loadSystemStatus}
    />
  );
};

const SystemStatusPage = () => {
  return (
    <>
      <DocumentTitle title="Status" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>Status</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Status
      </Heading>

      <SystemStatusContainer />
    </>
  );
};

export default SystemStatusPage;
