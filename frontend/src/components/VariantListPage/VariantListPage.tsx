import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Center,
  Heading,
  HStack,
  ListItem,
  Spinner,
  Text,
  Tooltip,
  UnorderedList,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { del, get } from "../../api";
import { Store, atom, useStore } from "../../state";
import { VariantList, VariantListAccessLevel } from "../../types";

import ButtonWithConfirmation from "../ButtonWithConfirmation";
import DateTime from "../DateTime";
import { DescriptionList, DescriptionListItem } from "../DescriptionList";

import { EditVariantListButton } from "./EditVariantList";
import {
  VariantListSharingButton,
  accessLevelDescriptions,
} from "./VariantListSharingSettings";
import VariantListStatus from "./VariantListStatus";

const deleteVariantList = (uuid: string): Promise<void> => {
  return del(`/variant-lists/${uuid}/`);
};

const VariantListPage = (props: { variantListStore: Store<VariantList> }) => {
  const { variantListStore } = props;
  const variantList = useStore(variantListStore);

  const history = useHistory();
  const toast = useToast();

  const userCanEdit =
    variantList.access_level === VariantListAccessLevel.EDITOR ||
    variantList.access_level === VariantListAccessLevel.OWNER;

  return (
    <>
      <Heading as="h1" mb={4}>
        {variantList.label}
      </Heading>

      <VariantListStatus variantList={variantList} />

      {variantList.notes && <Text mb={4}>{variantList.notes}</Text>}

      <DescriptionList mb={4}>
        <DescriptionListItem label="Created">
          <DateTime datetime={variantList.created_at} />
        </DescriptionListItem>
        <DescriptionListItem label="Last updated">
          <DateTime datetime={variantList.updated_at} />
        </DescriptionListItem>
      </DescriptionList>

      {userCanEdit && (
        <HStack mb={4}>
          <EditVariantListButton size="sm" variantListStore={variantListStore}>
            Edit
          </EditVariantListButton>

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

      {variantList.access_permissions && (
        <>
          <Heading as="h2" size="md" mb={2}>
            Sharing
          </Heading>
          <UnorderedList mb={4}>
            {variantList.access_permissions.map((accessPermission) => {
              return (
                <ListItem key={accessPermission.user} mb={2}>
                  {accessPermission.user}{" "}
                  <Tooltip
                    hasArrow
                    label={accessLevelDescriptions[accessPermission.level]}
                    placement="right"
                  >
                    <Badge>{accessPermission.level}</Badge>
                  </Tooltip>
                </ListItem>
              );
            })}
          </UnorderedList>
          <HStack mb={4}>
            <VariantListSharingButton
              size="sm"
              variantListStore={variantListStore}
            >
              Edit
            </VariantListSharingButton>
          </HStack>
        </>
      )}

      <Heading as="h2" size="md" mb={2}>
        Variants
      </Heading>

      {variantList.variants.length > 0 ? (
        <UnorderedList mb={4}>
          {variantList.variants.map((variantId) => (
            <ListItem key={variantId}>{variantId}</ListItem>
          ))}
        </UnorderedList>
      ) : (
        <Text mb={4}>
          {variantList.type === "gnomad" &&
          (variantList.status === "Queued" ||
            variantList.status === "Processing")
            ? "Variants will be automatically populated for gnomAD variant lists."
            : "This variant list has no variants."}
        </Text>
      )}
    </>
  );
};

const VariantListPageContainer = (props: { uuid: string }) => {
  const { uuid } = props;

  const variantListStoreRef = useRef<Store<VariantList> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    get(`/variant-lists/${uuid}/`)
      .then((variantList) => {
        variantListStoreRef.current = atom(variantList);
      }, setError)
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

  if (error) {
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
          </Breadcrumb>
        </Box>
        <Heading as="h1" mb={4}>
          Error
        </Heading>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Unable to load variant list</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </>
    );
  }

  if (variantListStoreRef.current) {
    const variantListStore = variantListStoreRef.current;
    const variantList = variantListStore.get();
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
        <VariantListPage variantListStore={variantListStore} />
      </>
    );
  }

  return null;
};

export default VariantListPageContainer;
