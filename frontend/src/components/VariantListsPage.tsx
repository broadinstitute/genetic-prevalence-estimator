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
  Divider,
  Heading,
  ListItem,
  Spinner,
  Text,
  UnorderedList,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get } from "../api";
import { VariantList } from "../types";
import Link from "./Link";

const VariantLists = ({ variantLists }: { variantLists: VariantList[] }) => {
  return (
    <UnorderedList>
      {variantLists.map((variantList) => (
        <ListItem key={variantList.uuid}>
          <Link to={`/variant-lists/${variantList.uuid}/`}>
            {variantList.label}
          </Link>
        </ListItem>
      ))}
    </UnorderedList>
  );
};

const VariantListsContainer = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [variantLists, setVariantLists] = useState<VariantList[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    get("/variant-lists/")
      .then((response) => response.variant_lists)
      .then((variantLists) => setVariantLists(variantLists), setError)
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

  if (variantLists.length === 0) {
    return <Text>No variant lists.</Text>;
  }

  return <VariantLists variantLists={variantLists} />;
};

const VariantListsPage = () => {
  return (
    <>
      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>Variant Lists</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        Variant lists
      </Heading>

      <VariantListsContainer />

      <Divider mb={4} mt={4} />

      <Text>
        <Link to="/variant-lists/new/">Create a new variant list</Link>
      </Text>
    </>
  );
};

export default VariantListsPage;
