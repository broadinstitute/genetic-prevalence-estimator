import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Center,
  Heading,
  HStack,
  ListItem,
  OrderedList,
  Spinner,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { del, get } from "../api";
import { VariantList, VariantListAccessLevel } from "../types";

import ButtonWithConfirmation from "./ButtonWithConfirmation";
import DateTime from "./DateTime";
import { DescriptionList, DescriptionListItem } from "./DescriptionList";

const deleteVariantList = (uuid: string): Promise<void> => {
  return del(`/variant-lists/${uuid}/`);
};

const VariantListPage = ({ variantList }: { variantList: VariantList }) => {
  const history = useHistory();
  const toast = useToast();

  const userCanEdit =
    variantList.access_level === VariantListAccessLevel.EDITOR ||
    variantList.access_level === VariantListAccessLevel.OWNER;

  return (
    <>
      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/variant-lists/">
              Variant Lists
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <span>{variantList.label}</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        {variantList.label}
      </Heading>

      {variantList.description && <Text mb={4}>{variantList.description}</Text>}

      <DescriptionList mb={4}>
        <DescriptionListItem label="Status">
          {variantList.status}
        </DescriptionListItem>
        <DescriptionListItem label="Created">
          <DateTime datetime={variantList.created_at} />
        </DescriptionListItem>
        <DescriptionListItem label="Last updated">
          <DateTime datetime={variantList.updated_at} />
        </DescriptionListItem>
      </DescriptionList>

      {userCanEdit && (
        <HStack mb={4}>
          <Button
            as={RRLink}
            size="sm"
            to={`/variant-lists/${variantList.uuid}/edit/`}
          >
            Edit
          </Button>

          {variantList.access_level === VariantListAccessLevel.OWNER && (
            <ButtonWithConfirmation
              size="sm"
              colorScheme="red"
              confirmationPrompt="This cannot be undone."
              confirmButtonText="Delete"
              onClick={() => {
                deleteVariantList(variantList.uuid).then(
                  () => {
                    history.push("/variant-lists/");
                  },
                  (error) => {
                    toast({
                      title: "Unable to delete variant list",
                      description: error.message,
                      status: "error",
                      duration: 10000,
                      isClosable: true,
                    });
                  }
                );
              }}
            >
              Delete
            </ButtonWithConfirmation>
          )}
        </HStack>
      )}

      <Heading as="h2" size="md" mb={2}>
        Variants
      </Heading>

      {variantList.variants.length > 0 ? (
        <OrderedList>
          {variantList.variants.map((variantId) => (
            <ListItem key={variantId}>{variantId}</ListItem>
          ))}
        </OrderedList>
      ) : (
        <Text>
          Variants will be automatically populated for gnomAD variant lists.
        </Text>
      )}
    </>
  );
};

export const withVariantList = (
  Component: React.ComponentType<{ variantList: VariantList }>
) => {
  return (props: { uuid: string }) => {
    const { uuid } = props;

    const [isLoading, setIsLoading] = useState(false);
    const [variantList, setVariantList] = useState<VariantList | null>(null);
    useEffect(() => {
      setIsLoading(true);
      setVariantList(null);
      get(`/variant-lists/${uuid}/`)
        .then((response) => response.variant_list)
        .then((variantList) => {
          setVariantList(variantList);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, [uuid]);

    if (isLoading) {
      return (
        <Center>
          <Spinner size="lg" />
        </Center>
      );
    }

    if (variantList) {
      return <Component variantList={variantList} />;
    }

    return null;
  };
};

const VariantListPageContainer = withVariantList(VariantListPage);

export default VariantListPageContainer;
