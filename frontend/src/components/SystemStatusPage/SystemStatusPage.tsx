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
  Link,
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
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";
import { FixedSizeList } from "react-window";

import { get } from "../../api";
import { VariantListStatus } from "../../types";

import DocumentTitle from "../DocumentTitle";

interface SystemStatusError {
  error: string;
  label: string;
  uuid: string;
}

interface QueuedOrProcessingVariantList {
  uuid: string;
  label: string;
  status: VariantListStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  gene_symbol: string | null;
  gnomad_version: string | null;
}

interface SystemStatus {
  variant_lists: {
    [key in VariantListStatus]: number;
  };
  error_details: SystemStatusError[];
  queued_and_processing_lists: QueuedOrProcessingVariantList[];
}

interface SystemStatusViewProps {
  systemStatus: SystemStatus;
}

interface SystemStatusErrorRowData {
  systemStatusErrors: SystemStatusError[];
  onViewError: (systemStatusError: SystemStatusError) => void;
}

const ERROR_PREVIEW_LENGTH = 30;
const ERROR_ROW_HEIGHT = 70;
const ERRORS_DISPLAYED = 10;

const getErrorPreview = (error: string) => {
  if (error.length <= ERROR_PREVIEW_LENGTH) {
    return error;
  }

  return `${error.slice(0, ERROR_PREVIEW_LENGTH)}...`;
};

const SystemStatusErrorRow = ({
  index,
  data,
  style,
}: {
  index: number;
  data: SystemStatusErrorRowData;
  style: React.CSSProperties;
}) => {
  const systemStatusError = data.systemStatusErrors[index];

  return (
    <Tr
      sx={{
        display: "flex",
        alignItems: "stretch",
        boxSizing: "border-box",
        background: index % 2 === 1 ? "initial" : "#edf2f7",
      }}
      style={style}
    >
      <Td width="30%">
        <Link as={RRLink} to={`/variant-lists/${systemStatusError.uuid}`}>
          {systemStatusError.label}
        </Link>
      </Td>
      <Td width="70%">
        {systemStatusError.error ? (
          <Button
            variant="link"
            colorScheme="blue"
            rightIcon={<ViewIcon />}
            textDecoration="underline"
            whiteSpace="normal"
            textAlign="left"
            aria-label={`View full error for ${systemStatusError.label}`}
            onClick={() => {
              data.onViewError(systemStatusError);
            }}
          >
            {getErrorPreview(systemStatusError.error)}
          </Button>
        ) : (
          "No error details"
        )}
      </Td>
    </Tr>
  );
};

const SystemStatusErrorModal = ({
  systemStatusError,
  onClose,
}: {
  systemStatusError: SystemStatusError | null;
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

const SystemStatusErrorTable = ({
  systemStatusErrors,
}: {
  systemStatusErrors: SystemStatusError[];
}) => {
  const [
    selectedSystemStatusError,
    setSelectedSystemStatusError,
  ] = useState<SystemStatusError | null>(null);

  return (
    <>
      <Table variant="striped" mt={8}>
        <Thead>
          <Tr sx={{ display: "flex" }}>
            <Th scope="col" width="30%">
              List label
            </Th>
            <Th scope="col" width="70%">
              Error
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          <FixedSizeList
            height={
              Math.min(systemStatusErrors.length, ERRORS_DISPLAYED) *
              ERROR_ROW_HEIGHT
            }
            itemCount={systemStatusErrors.length}
            itemSize={ERROR_ROW_HEIGHT}
            width="100%"
            overscanCount={5}
            itemData={{
              systemStatusErrors,
              onViewError: setSelectedSystemStatusError,
            }}
            style={{ overflowX: "hidden" }}
          >
            {SystemStatusErrorRow}
          </FixedSizeList>
        </Tbody>
      </Table>

      <SystemStatusErrorModal
        systemStatusError={selectedSystemStatusError}
        onClose={() => {
          setSelectedSystemStatusError(null);
        }}
      />
    </>
  );
};

const QUEUED_OR_PROCESSING_ROW_HEIGHT = 50;
const QUEUED_OR_PROCESSING_ROWS_DISPLAYED = 10;

const TRUNCATED_CELL_STYLE = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const STATUS_GLYPHS: { [key in VariantListStatus]: string } = {
  Queued: "○",
  Processing: "◐",
  Ready: "●",
  Error: "✕",
};

const compactDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

const formatCompactDateTime = (datetime: string) => {
  return compactDateTimeFormatter.format(new Date(datetime));
};

const QueuedOrProcessingVariantListRow = ({
  index,
  data,
  style,
}: {
  index: number;
  data: QueuedOrProcessingVariantList[];
  style: React.CSSProperties;
}) => {
  const variantList = data[index];

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
      <Td width="25%" sx={TRUNCATED_CELL_STYLE}>
        <Link as={RRLink} to={`/variant-lists/${variantList.uuid}`}>
          {variantList.label}
        </Link>
      </Td>
      <Td width="13%">
        {STATUS_GLYPHS[variantList.status]} {variantList.status}
      </Td>
      <Td width="18%" sx={TRUNCATED_CELL_STYLE}>
        {variantList.created_by ?? "Unknown"}
      </Td>
      <Td width="10%">{variantList.gene_symbol ?? ""}</Td>
      <Td width="8%">{variantList.gnomad_version ?? ""}</Td>
      <Td width="13%">{formatCompactDateTime(variantList.created_at)}</Td>
      <Td width="13%">{formatCompactDateTime(variantList.updated_at)}</Td>
    </Tr>
  );
};

const QueuedOrProcessingVariantListTable = ({
  variantLists,
}: {
  variantLists: QueuedOrProcessingVariantList[];
}) => {
  if (variantLists.length === 0) {
    return <Text mt={4}>No variant lists are queued or processing.</Text>;
  }

  return (
    <Table variant="striped" mt={4}>
      <Thead>
        <Tr sx={{ display: "flex" }}>
          <Th scope="col" width="25%">
            List label
          </Th>
          <Th scope="col" width="13%">
            Status
          </Th>
          <Th scope="col" width="18%">
            Created by
          </Th>
          <Th scope="col" width="10%">
            Gene
          </Th>
          <Th scope="col" width="8%">
            gnomAD
          </Th>
          <Th scope="col" width="13%">
            Created
          </Th>
          <Th scope="col" width="13%">
            Last updated
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        <FixedSizeList
          height={
            Math.min(variantLists.length, QUEUED_OR_PROCESSING_ROWS_DISPLAYED) *
            QUEUED_OR_PROCESSING_ROW_HEIGHT
          }
          itemCount={variantLists.length}
          itemSize={QUEUED_OR_PROCESSING_ROW_HEIGHT}
          width="100%"
          overscanCount={5}
          itemData={variantLists}
          style={{ overflowX: "hidden" }}
        >
          {QueuedOrProcessingVariantListRow}
        </FixedSizeList>
      </Tbody>
    </Table>
  );
};

const SystemStatusView = (props: SystemStatusViewProps) => {
  const { systemStatus } = props;

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
            <SystemStatusErrorTable
              systemStatusErrors={systemStatus.error_details}
            />
          </TabPanel>
          <TabPanel px={0}>
            <QueuedOrProcessingVariantListTable
              variantLists={systemStatus.queued_and_processing_lists}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  );
};

const SystemStatusContainer = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    get("/status/")
      .then(setSystemStatus, setError)
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
        <AlertTitle>Unable to load variant lists</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return <SystemStatusView systemStatus={systemStatus!} />;
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
