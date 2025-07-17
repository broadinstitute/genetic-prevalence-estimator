import { AddIcon } from "@chakra-ui/icons";
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
  Button,
  Center,
  Heading,
  Link as ChakraLink,
  Select,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";
import { Link as RRLink } from "react-router-dom";

import { get } from "../api";
import { appConfigStore, authStore, useStore } from "../state";
import { VariantList } from "../types";
import DateTime from "./DateTime";
import DocumentTitle from "./DocumentTitle";
import Link from "./Link";
import { formatVariantListType } from "./VariantListPage/VariantListMetadata";

interface VariantListMetadataSummaryProps {
  variantList: VariantList;
}

const VariantListMetadataSummary: FC<VariantListMetadataSummaryProps> = ({
  variantList,
}) => {
  return (
    <>
      {formatVariantListType(variantList)} variant list, gnomAD{" "}
      {variantList.metadata.gnomad_version}
      {variantList.metadata.transcript_id &&
        `, ${variantList.metadata.gene_id} / ${variantList.metadata.transcript_id}`}
      {variantList.variants?.length &&
        `, ${variantList.variants.length} variants`}
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
            <VariantListMetadataSummary variantList={variantList} />
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
  const appConfig = useStore(appConfigStore);
  const { isSignedIn, user } = useStore(authStore);
  const [isLoading, setIsLoading] = useState(true);
  const [variantLists, setVariantLists] = useState<VariantList[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [orderBy, setOrderBy] = useState("-updated_at");

  useEffect(() => {
    setIsLoading(true);
    get("/variant-lists/", {
      ordering: Array.isArray(orderBy) ? orderBy.join(",") : orderBy,
    })
      .then((variantLists) => setVariantLists(variantLists), setError)
      .finally(() => {
        setIsLoading(false);
      });
  }, [orderBy]);

  const userHasNotCreatedMaxNumberOfVariantLists =
    variantLists.length < appConfig!.max_variant_lists_per_user;

  const userIsStaff = isSignedIn && user && user.is_staff;

  const canCreateVariantList =
    !isLoading &&
    !error &&
    (userHasNotCreatedMaxNumberOfVariantLists || userIsStaff);

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
  } else if (variantLists.length === 0) {
    content = (
      <Text>
        No variant lists have been created yet.{" "}
        <Link to="/variant-lists/new/">Create a variant list.</Link>
      </Text>
    );
  } else {
    content = (
      <>
        {!canCreateVariantList && (
          <Text mb={4}>
            You have created the maximum number of variant lists. Delete one to
            create another.
          </Text>
        )}

        <VariantLists variantLists={variantLists} />
      </>
    );
  }

  return (
    <>
      <Box display="flex" flexFlow="row wrap" alignItems="flex-end">
        <Heading as="h1" flexGrow={0} mb={4}>
          Variant lists
        </Heading>

        <Box flexGrow={1} mb={4} ml={2} pb={1}>
          {canCreateVariantList ? (
            <Tooltip hasArrow label="Create new variant list">
              <Button
                as={RRLink}
                aria-label="Create new variant list"
                to="/variant-lists/new/"
                colorScheme="blue"
                size="sm"
              >
                <AddIcon aria-hidden />
              </Button>
            </Tooltip>
          ) : (
            <Button aria-label="Create new variant list" disabled size="sm">
              <AddIcon aria-hidden />
            </Button>
          )}
        </Box>

        <Box display="inline-block" flexGrow={0} mb={4} whiteSpace="nowrap">
          <Text as="label" htmlFor="variant-lists-order">
            Order by{" "}
            <Select
              id="variant-lists-order"
              value={orderBy}
              onChange={(e) => {
                setOrderBy(e.target.value);
              }}
              display="inline-block"
              width={180}
            >
              <option value="label">Name</option>
              <option value="-updated_at">Last updated</option>
            </Select>
          </Text>
        </Box>
      </Box>

      {content}
    </>
  );
};

const VariantListsPage = () => {
  return (
    <>
      <DocumentTitle title="Variant lists" />

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

      <VariantListsContainer />
    </>
  );
};

export default VariantListsPage;
