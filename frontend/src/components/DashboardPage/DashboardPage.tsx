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
  Stat,
  StatGroup,
  StatLabel,
  StatNumber,
  Table,
  Text,
  Thead,
  Tbody,
  Tfoot,
  Tr,
  Th,
  Td,
  TableCaption,
  TableContainer,
} from "@chakra-ui/react";
import { AddIcon, AttachmentIcon } from '@chakra-ui/icons'
import { useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get } from "../../api";
import { VariantListStatus } from "../../types";

import DocumentTitle from "../DocumentTitle";

const SupportingDocuments = ({document_exists}: any) => {
  const [document, setDocument] = useState(document_exists);
  
  return document ? (
      <><h1> Supporting Documents</h1 >
    <Button rightIcon={<AttachmentIcon />} colorScheme='teal' variant='outline'>
      Supporting document
    </Button></>

    ) : (
  <h1>No document</h1>
);

    
  
}

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

      <DashboardContainer/>
    </>
  );

}


const DashboardContainer = () => {
  const temp_data = [
    {
      gene: "PCSK9", gnomad_lof: "1/200000", genie_estimates: "1/250000", genie_link: "abcde", is_document: false, notes: "nothing", 
      prevalence_orph: "1/150000", prevalence_orph_link: "aoisf", prevalence_genereviews: "1/1000000", prevalence_genereviews_link: "aosifo",
      prevalence_other: "oaihs", incidence_other: "aosihfapi"
    },
    {
      gene: "BRCA2", gnomad_lof: "1/300000", genie_estimates: "1/100000", genie_link: "sdoih", is_document: true, notes: "nothing", 
      prevalence_orph: "1/140000", prevalence_orph_link: "oaish", prevalence_genereviews: "1/1200000", prevalence_genereviews_link: "awoiehg",
      prevalence_other: "oaihs", incidence_other: "aosihfapi"
    }
  ]
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {

    setIsLoading(true);
    //@ts-ignore
    setData(temp_data);

    //TO DO

    // get("/variant-lists/", {
    //   ordering: Array.isArray(orderBy) ? orderBy.join(",") : orderBy,
    // })
    //   .then((variantLists) => setVariantLists(variantLists), setError)
    //   .finally(() => {
    //     setIsLoading(false);
    //   });

    // TO DO
    //setIsLoading(false);
    

  }, [temp_data]);

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
    content = (
      <Text>
        No prevalence lists have been created yet.{" "}
      </Text>
    );
  } else {
    content = (
      <>
        <TableContainer>
        <Table variant='simple'>
          <TableCaption>Imperial to metric conversion factors</TableCaption>
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
            {data.map(
              (d: any) => {
                return (
                  <Tr>
                    <Td>{d.gene}</Td>
                    <Td>{d.gnomad_lof}</Td>
                    <Td><Link as={RRLink} to={`/variantlist/${d.genie_link}`}>
                      {d.genie_estimates}
                    </Link></Td>
                    <Td><SupportingDocuments 
                    document_exists = {d.is_document}/></Td>
                    <Td>{d.contact}</Td>
                    <Td>{d.notes}</Td>
                    <Td><Link as={RRLink} to={`/variantlist/${d.prevalence_orph_link}`}>
                      {d.prevalence_orph}
                    </Link></Td>
                    <Td><Link as={RRLink} to={`/variantlist/${d.prevalence_genereviews_link}`}>
                      {d.prevalence_genereviews}
                    </Link></Td>
                    <Td>{d.prevalence_other}</Td>
                    <Td>{d.incidence_other}</Td>
                  </Tr>
                )
              }

            )}
          </Tbody>
        </Table>
      </TableContainer>
      </>
    );
  }

  return (
    <>
      <h1>Dashboard Page</h1>
      {content}



    </>
  );
};

export default DashboardContainer;