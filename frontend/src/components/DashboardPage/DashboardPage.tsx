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
  Flex,
} from "@chakra-ui/react";
import { AttachmentIcon } from "@chakra-ui/icons";
import { FC, useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import DocumentTitle from "../DocumentTitle";
import { get } from "../../api";

const SupportingDocuments = ({ document_exists }: any) => {
  const [document, setDocument] = useState(document_exists);

  return document ? (
    <Box height={"2rem"}>
      <Button
        rightIcon={<AttachmentIcon />}
        size="sm"
        colorScheme="teal"
        variant="outline"
      >
        Document.pdf
      </Button>
    </Box>
  ) : (
    <Box height={"2rem"}>
      <Text>No document</Text>
    </Box>
  );
};

type DashboardRow = {
  gene: string;
  gnomad_lof: string;
  genie_estimates: string;
  genie_link: string;
  has_document: boolean;
  additional_resources: string;
  prevalence_orph: string;
  prevalence_orph_link: string;
  prevalence_genereviews: string;
  prevalence_genereviews_link: string;
  prevalence_other: string;
  incidence_other: string;
};

const MTh = ({ children, w }: any) => {
  return (
    <Th
      color="black"
      fontSize="0.75rem"
      lineHeight="1.5rem"
      h="3rem"
      width={w}
      overflow="hidden"
      whiteSpace="pre-line"
    >
      {children}
    </Th>
  );
};

const DashboardList: FC<{ dashboardList: DashboardRow[] }> = ({
  dashboardList,
}) => {
  return (
    <TableContainer mb={"5rem"}>
      <Table variant="striped" size="sm" layout="fixed">
        <Thead>
          {/* TODO: second row that has the header-header things */}
          {/* <Tr bg='lightgrey' h='5rem' display='flex'>
            <MTh flex-grow='1'>Test1</MTh>
            <MTh>Test1</MTh>
            <MTh>Test1</MTh>
          </Tr> */}
          <Tr bg="lightgrey" h="5rem">
            <MTh>Gene</MTh>
            <MTh>ClinVar LP/P and gnomAD LoF</MTh>
            <MTh>Estimates available on GeniE</MTh>
            <MTh>Contact for Public Estimate</MTh>
            <MTh>Supporting Documents</MTh>
            <MTh>Additional Resources</MTh>
            <MTh>Prevalence Orphanet</MTh>
            <MTh>Prevalence GeneReviews</MTh>
            <MTh>Prevalence Other</MTh>
            <MTh>Incidence Other</MTh>
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
                    to={dashboardRow.genie_link}
                    // to={`/variantlist/${dashboardRow.genie_link}`}
                  >
                    {dashboardRow.genie_estimates}
                  </Link>
                </Td>

                <Td>{dashboardRow.contact}</Td>
                <Td>
                  <SupportingDocuments
                    document_exists={dashboardRow.has_document}
                  />
                </Td>
                <Td>{dashboardRow.additional_resources}</Td>
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

const createMockDataRow = (
  geneSymbol: string,
  gnomad_lof: string,
  genie_estimates: string,
  contact: string,
  has_document: boolean,
  additional_resources: string,
  prevalence_orphanet: string,
  prevalence_gene_reviews: string,
  prevalence_other: string,
  incidence_other: string
) => {
  const mockRow = {
    gene: geneSymbol,
    gnomad_lof: gnomad_lof,
    genie_estimates: genie_estimates,
    genie_link: "abcde",
    has_document: has_document,
    contact: contact,
    additional_resources: additional_resources,
    prevalence_orph: prevalence_orphanet,
    prevalence_orph_link: "todo_0",
    prevalence_genereviews: prevalence_gene_reviews,
    prevalence_genereviews_link: "todo_1",
    prevalence_other: prevalence_other,
    incidence_other: incidence_other,
  };
  return mockRow;
};

const transformResponse = (publicVariantLists: any[]) => {
  console.log(publicVariantLists);

  const newList = publicVariantLists.map((pvl) => {
    const item = {
      gene: pvl.variant_list.metadata.gene_symbol,
      gnomad_lof: "1/450,000", // TODO:
      genie_estimates: "1/250,000", // TODO:
      genie_link: `/variant-lists/${pvl.variant_list.uuid}`,
      has_document: true,
      contact: pvl.submitted_by,
      additional_resources: "PMID: #####",
      prevalence_orph: "<1,100,000", // TODO:
      prevalence_orph_link: "todo_0",
      prevalence_genereviews: "<1/1,100,000>", // TODO:
      prevalence_genereviews_link: "todo_1",
      prevalence_other: "PMID: #####",
      incidence_other: "PMID: #####",
    };
    return item;
  });

  return newList;
};

const DashboardContainer = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const mock_data = [
    createMockDataRow(
      "ACADVL",
      "1/450,000",
      "1/250,000",
      "freqcalc@broad",
      true,
      "PMID: #####",
      "<1,100,000",
      "<1/1,000,000",
      "PMID: #####",
      "PMID: #####"
    ),
    createMockDataRow(
      "AKT3",
      "1/2,350,000",
      "1/200,000",
      "freqcalc@broad",
      true,
      "",
      "<1,100,000",
      "<1/1,000,000",
      "",
      ""
    ),
    createMockDataRow(
      "ATM",
      "1/25,000",
      "1/40,000",
      "freqcalc@broad",
      true,
      "",
      "<1,100,000",
      "<1/1,000,000",
      "",
      ""
    ),
    createMockDataRow(
      "BRAF",
      "1/2,350,000",
      "1/4,000,000",
      "freqcalc@broad",
      true,
      "PMID: #####",
      "<1,100,000",
      "<1/1,000,000",
      "PMID: #####",
      ""
    ),
    createMockDataRow(
      "CDH1",
      "1/450,000",
      "1/300,000",
      "expertpanel@email",
      false,
      "PMID: #####",
      "<1,100,000",
      "<1/1,000,000",
      "",
      ""
    ),
    createMockDataRow(
      "CDH23",
      "1/2,350,000",
      "1/1,000,000",
      "expertpanel@email",
      false,
      "",
      "<1,100,000",
      "<1/1,000,000",
      "",
      ""
    ),
    createMockDataRow(
      "CDKL5",
      "1/25,000",
      "",
      "",
      false,
      "",
      "1,100,000",
      "1/1,000,000",
      "",
      "PMID: #####"
    ),
    createMockDataRow(
      "COCH",
      "1/2,350,000",
      "",
      "",
      false,
      "",
      "1,100,000",
      "",
      "",
      ""
    ),
    createMockDataRow(
      "DICER1",
      "1/450,000",
      "1/1,400,000",
      "expertpanel@email",
      true,
      "",
      "<1,000,000",
      "1/1,000,000",
      "",
      ""
    ),
    createMockDataRow(
      "ETHE1",
      "1/2,350,000",
      "",
      "",
      false,
      "",
      "1/1,100,000",
      "",
      "",
      ""
    ),
    createMockDataRow(
      "FBN1",
      "1/25,000",
      "1/10,000",
      "expertpanel@email",
      true,
      "",
      "1/90,000",
      "1/90,000",
      "",
      ""
    ),
  ];

  useEffect(() => {
    setIsLoading(true);

    // TODO: (rgrant) This call to variant lists does nothing, make this call
    //   the new endpoint once that is created
    get("/public-variant-lists/")
      .then((publicVariantLists) => {
        const shapedData = transformResponse(publicVariantLists);
        setData(mock_data.concat(shapedData));
      }, setError)
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
      <Box mb={4}>
        <Text mb={2}>
          The dashboard gives an at a glance view of the available prevalence
          estimates across multiple sources.
        </Text>
        <Text>
          Please reach out directly to the contact for a given gene if you would
          like more information, or would like to contribute to the public list
          on Genie.
        </Text>
      </Box>

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
