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
  Table,
  Tbody,
  Td,
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

interface SystemStatus {
  variant_lists: {
    [key in VariantListStatus]: number;
  };
  error_details: SystemStatusError[];
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
        <Link
          as={RRLink}
          to={`/variant-lists/${systemStatusError.uuid}`}
        >
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

const SystemStatusView = (props: SystemStatusViewProps) => {
  const { systemStatus } = props;
  const [selectedSystemStatusError, setSelectedSystemStatusError] =
    useState<SystemStatusError | null>(null);

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
      <Box mt={12}>
        <h1>Summary of errors</h1>
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
                Math.min(
                  systemStatus.error_details.length,
                  ERRORS_DISPLAYED
                ) * ERROR_ROW_HEIGHT
              }
              itemCount={systemStatus.error_details.length}
              itemSize={ERROR_ROW_HEIGHT}
              width="100%"
              overscanCount={5}
              itemData={{
                systemStatusErrors: systemStatus.error_details,
                onViewError: setSelectedSystemStatusError,
              }}
              style={{ overflowX: "hidden" }}
            >
              {SystemStatusErrorRow}
            </FixedSizeList>
          </Tbody>
        </Table>
      </Box>

      <SystemStatusErrorModal
        systemStatusError={selectedSystemStatusError}
        onClose={() => {
          setSelectedSystemStatusError(null);
        }}
      />
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
