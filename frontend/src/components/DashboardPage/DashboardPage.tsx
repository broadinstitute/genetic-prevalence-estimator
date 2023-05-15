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
  Spinner,
  Table,
  Text,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from "@chakra-ui/react";
import { AttachmentIcon } from "@chakra-ui/icons";
import { FC, useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import DocumentTitle from "../DocumentTitle";
import { get } from "../../api";

const SupportingDocuments = ({ document_exists }: any) => {
  const [document, setDocument] = useState(document_exists);

  return document ? (
    <>
      <Button
        rightIcon={<AttachmentIcon />}
        size="sm"
        colorScheme="teal"
        variant="outline"
      >
        Supporting document
      </Button>
    </>
  ) : (
    <Text>No document</Text>
  );
};

interface DashboardListProps {
  dashboardList: any[];
}

const DashboardList: FC<DashboardListProps> = ({ dashboardList }) => {
  return (
    <TableContainer>
      <Table variant="striped" size="sm">
        <Thead>
          <Tr>
            <Th>Gene</Th>
            <Th>ClinVar LP/P and gnomAD LoF</Th>
            <Th>Estimates available on GeniE</Th>
            <Th>Supporting Documents</Th>
            <Th>Contact</Th>
            <Th>Notes</Th>
            <Th>Prevalence Orphanet</Th>
            <Th>Prevalence GeneReviews</Th>
            <Th>Prevalence Other</Th>
            <Th>Incidence Other</Th>
          </Tr>
        </Thead>
        <Tbody>
          {dashboardList.map((dashboardRow: any) => {
            return (
              <Tr>
                <Td>{dashboardRow.gene}</Td>
                <Td>{dashboardRow.gnomad_lof}</Td>
                <Td>
                  <Link
                    as={RRLink}
                    to={`/variantlist/${dashboardRow.genie_link}`}
                  >
                    {dashboardRow.genie_estimates}
                  </Link>
                </Td>
                <Td>
                  <SupportingDocuments
                    document_exists={dashboardRow.is_document}
                  />
                </Td>
                <Td>{dashboardRow.contact}</Td>
                <Td>{dashboardRow.notes}</Td>
                <Td>
                  <Link
                    as={RRLink}
                    to={`/variantlist/${dashboardRow.prevalence_orph_link}`}
                  >
                    {dashboardRow.prevalence_orph}
                  </Link>
                </Td>
                <Td>
                  <Link
                    as={RRLink}
                    to={`/variantlist/${dashboardRow.prevalence_genereviews_link}`}
                  >
                    {dashboardRow.prevalence_genereviews}
                  </Link>
                </Td>
                <Td>{dashboardRow.prevalence_other}</Td>
                <Td>{dashboardRow.incidence_other}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </TableContainer>
  );
};

const DashboardContainer = () => {
  const mock_data = [
    {
      gene: "PCSK9",
      gnomad_lof: "1/200000",
      genie_estimates: "1/250000",
      genie_link: "abcde",
      is_document: false,
      notes: "",
      prevalence_orph: "1/150000",
      prevalence_orph_link: "aoisf",
      prevalence_genereviews: "1/1000000",
      prevalence_genereviews_link: "aosifo",
      prevalence_other: "oaihs",
      incidence_other: "aosihfapi",
    },
    {
      gene: "BRCA2",
      gnomad_lof: "1/300000",
      genie_estimates: "1/100000",
      genie_link: "sdoih",
      is_document: true,
      notes: "",
      prevalence_orph: "1/140000",
      prevalence_orph_link: "oaish",
      prevalence_genereviews: "1/1200000",
      prevalence_genereviews_link: "awoiehg",
      prevalence_other: "oaihs",
      incidence_other: "aosihfapi",
    },
  ];
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);

    // TODO: (rgrant) This call to variant lists does nothing, make this call
    //   the new endpoint once that is created
    get("/variant-lists/")
      .then(() => setData(mock_data), setError)
      .finally(() => {
        setIsLoading(false);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let content = null;

  if (isLoading) {
    content = (
      <Center>
        <Spinner size="lg" />
      </Center>
    );
  } else if (error) {
    content = (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>Unable to load variant lists</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  } else if (data.length === 0) {
    content = <Text>There are no entries in the dashboard</Text>;
  } else {
    content = <DashboardList dashboardList={data} />;
  }

  return (
    <>
      <Text mb={4}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Amet massa vitae
        tortor condimentum lacinia. Elementum facilisis leo vel fringilla est
        ullamcorper eget nulla. Platea dictumst vestibulum rhoncus est
        pellentesque elit ullamcorper.
      </Text>
      {content}
    </>
  );
};

const DashboardPage = () => {
  return (
    <>
      <DocumentTitle title="Prevalence lists" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>Prevalence Lists</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Dashboard
      </Heading>

      <DashboardContainer />
    </>
  );
};

export default DashboardPage;
