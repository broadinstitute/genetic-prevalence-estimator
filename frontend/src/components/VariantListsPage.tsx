import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  BoxProps,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Center,
  Heading,
  Link as ChakraLink,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get } from "../api";
import {
  CustomVariantList,
  RecommendedVariantList,
  VariantList,
  VariantListType,
} from "../types";
import DateTime from "./DateTime";
import Link from "./Link";

interface CustomVariantListMetadataProps {
  variantList: CustomVariantList;
}

const CustomVariantListMetadata: FC<CustomVariantListMetadataProps> = ({
  variantList,
}) => {
  return (
    <>
      Custom variant list, gnomAD {variantList.metadata.gnomad_version},{" "}
      {variantList.variants.length} variants
    </>
  );
};

interface RecommendedVariantListMetadataProps {
  variantList: RecommendedVariantList;
}

const RecommendedVariantListMetadata: FC<RecommendedVariantListMetadataProps> = ({
  variantList,
}) => {
  return (
    <>
      Recommended variant list, gnomAD {variantList.metadata.gnomad_version},{" "}
      {variantList.metadata.gene_id} / {variantList.metadata.transcript_id}
    </>
  );
};

interface VariantListCardProps extends BoxProps {
  variantList: VariantList;
}

const VariantListCard: FC<VariantListCardProps> = ({
  variantList,
  ...otherProps
}) => {
  return (
    <Box borderWidth="1px" shadow="md" {...otherProps}>
      <RRLink to={`/variant-lists/${variantList.uuid}/`}>
        <Box p="0.5rem 1rem">
          <ChakraLink as="span" fontSize="xl">
            {variantList.label}
          </ChakraLink>
          <Text as="div" fontSize="sm">
            {variantList.type === VariantListType.CUSTOM && (
              <CustomVariantListMetadata variantList={variantList} />
            )}
            {variantList.type === VariantListType.RECOMMENDED && (
              <RecommendedVariantListMetadata variantList={variantList} />
            )}
          </Text>
          <Text as="div" fontSize="sm">
            Last updated <DateTime datetime={variantList.updated_at} />
          </Text>
        </Box>
      </RRLink>
    </Box>
  );
};

interface VariantListsProps {
  variantLists: VariantList[];
}

const VariantLists: FC<VariantListsProps> = ({ variantLists }) => {
  return (
    <VStack role="list" align="stretch" spacing={4}>
      {variantLists.map((variantList) => (
        <VariantListCard
          key={variantList.uuid}
          role="listitem"
          variantList={variantList}
        />
      ))}
    </VStack>
  );
};

const VariantListsContainer = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [variantLists, setVariantLists] = useState<VariantList[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    get("/variant-lists/")
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

      <Text mt={4}>
        <Link to="/variant-lists/new/">Create a new variant list</Link>
      </Text>
    </>
  );
};

export default VariantListsPage;
