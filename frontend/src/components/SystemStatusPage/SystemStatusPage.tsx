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
  Spinner,
  Stat,
  StatGroup,
  StatLabel,
  StatNumber,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get } from "../../api";
import { VariantListStatus } from "../../types";

import DocumentTitle from "../DocumentTitle";

interface SystemStatus {
  variant_lists: {
    [key in VariantListStatus]: number;
  };
}

interface SystemStatusViewProps {
  systemStatus: SystemStatus;
}

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
