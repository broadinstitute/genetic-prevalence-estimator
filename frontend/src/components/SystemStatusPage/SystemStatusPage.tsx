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
  Center,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stat,
  StatGroup,
  StatLabel,
  StatNumber,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get } from "../../api";
import { VariantListStatus } from "../../types";

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

interface SystemStatusErroredVariantList extends SystemStatusVariantList {
  error: string;
}

interface SystemStatus {
  variant_lists: {
    [key in VariantListStatus]: number;
  };
  error_details: SystemStatusErroredVariantList[];
  queued_and_processing_lists: SystemStatusVariantList[];
}

interface SystemStatusViewProps {
  systemStatus: SystemStatus;
  refreshSystemStatus: () => void;
}

const ERRORS_DEFAULT_SORT: VariantListSort = {
  key: "updated_at",
  direction: "descending",
};

const QUEUED_OR_PROCESSING_DEFAULT_SORT: VariantListSort = {
  key: "updated_at",
  direction: "descending",
};

const summarizeError = (error: string) => {
  const lines = error.split("\n").filter((line) => line.trim() !== "");
  return lines[lines.length - 1]?.trim() ?? "";
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
      <Heading as="h2" size="md" mb={2}>
        Variant lists
      </Heading>
      <StatGroup>
        {Object.entries(systemStatus.variant_lists).map(
          ([status, numVariantLists]) => {
            return (
              <Stat key={status}>
                <StatLabel>{status}</StatLabel>
                <StatNumber>{numVariantLists.toLocaleString()}</StatNumber>
              </Stat>
            );
          }
        )}
      </StatGroup>
      <Tabs isLazy mt={12}>
        <TabList>
          <Tab>Errors ({systemStatus.error_details.length})</Tab>
          <Tab>
            {`Queued and processing (${systemStatus.queued_and_processing_lists.length})`}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <VariantListStatusTable
              variantLists={systemStatus.error_details}
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
              emptyMessage="No variant lists have errors."
            />
          </TabPanel>
          <TabPanel px={0}>
            <VariantListStatusTable
              variantLists={systemStatus.queued_and_processing_lists}
              columns={[
                labelColumn,
                statusColumn,
                createdByColumn,
                geneSymbolColumn,
                gnomadVersionColumn,
                createdAtColumn,
                updatedAtColumn,
                retryColumn(retryVariantList),
              ]}
              defaultSort={QUEUED_OR_PROCESSING_DEFAULT_SORT}
              emptyMessage="No variant lists are queued or processing."
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
