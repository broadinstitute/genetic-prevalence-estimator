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
import VariantListCalculations from "./VariantListCalculations";
import {
  VariantListSharingButton,
  accessLevelDescriptions,
} from "./VariantListSharingSettings";
import VariantListMetadata from "./VariantListMetadata";
import VariantListStatus from "./VariantListStatus";
import VariantListVariants from "./VariantListVariants";

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

      <VariantListMetadata variantList={variantList} />

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

      {variantList.status === "Ready" && (
        <>
          <Heading as="h2" size="md" mb={2}>
            Carrier frequency and Prevalence
          </Heading>

          <Box mb={4}>
            <VariantListCalculations
              populations={variantList.metadata.populations!}
              variants={variantList.variants}
            />
          </Box>
        </>
      )}

      <Heading as="h2" size="md" mb={2}>
        Variants
      </Heading>

      <VariantListVariants variantList={variantList} />
    </>
  );
};

const VariantListPageContainer = (props: { uuid: string }) => {
  const { uuid } = props;

  const variantListStoreRef = useRef<Store<VariantList> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let refreshInterval: number | undefined = undefined;
    let refreshCanceled = false;

    const refreshVariantList = () => {
      get(`/variant-lists/${uuid}/`).then(
        (variantList) => {
          if (refreshCanceled) {
            return;
          }

          variantListStoreRef.current?.set(variantList);

          if (
            !(
              variantList.status === "Queued" ||
              variantList.status === "Processing"
            )
          ) {
            window.clearInterval(refreshInterval);
          }
        },
        (error) => {
          window.clearInterval(refreshInterval);
          setError(error);
        }
      );
    };

    setIsLoading(true);
    get(`/variant-lists/${uuid}/`)
      .then((variantList) => {
        variantListStoreRef.current = atom(variantList);

        if (
          variantList.status === "Queued" ||
          variantList.status === "Processing"
        ) {
          refreshInterval = window.setInterval(refreshVariantList, 15000);
        }
      }, setError)
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      window.clearInterval(refreshInterval);
      refreshCanceled = true;
    };
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
