import { ChevronDownIcon } from "@chakra-ui/icons";
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
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  ListItem,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  OrderedList,
  Spinner,
  Text,
  UnorderedList,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { del, get, patch } from "../api";
import { VariantList, VariantListAccessLevel } from "../types";

import ButtonWithConfirmation from "./ButtonWithConfirmation";
import DateTime from "./DateTime";
import { DescriptionList, DescriptionListItem } from "./DescriptionList";

const VariantListSharingSettings = (props: {
  variantList: VariantList;
  onChange: (variantList: VariantList) => void;
}) => {
  const { variantList, onChange } = props;
  const toast = useToast();

  const setAccessLevel = (
    uuid: string,
    level: VariantListAccessLevel
  ): Promise<void> => {
    return patch(`/variant-list-access/${uuid}/`, { level }).then(
      () => {
        onChange({
          ...variantList,
          access_permissions: variantList.access_permissions?.map(
            (accessPermission) => {
              return accessPermission.uuid === uuid
                ? { ...accessPermission, level }
                : accessPermission;
            }
          ),
        });
      },
      (error) => {
        toast({
          title: "Unable to edit access",
          description: error.message,
          status: "error",
          duration: 10000,
          isClosable: true,
        });
      }
    );
  };

  const removeAccess = (uuid: string): Promise<void> => {
    return del(`/variant-list-access/${uuid}/`).then(
      () => {
        onChange({
          ...variantList,
          access_permissions: variantList.access_permissions?.filter(
            (accessPermission) => accessPermission.uuid !== uuid
          ),
        });
      },
      (error) => {
        toast({
          title: "Unable to remove access",
          description: error.message,
          status: "error",
          duration: 10000,
          isClosable: true,
        });
      }
    );
  };

  return (
    <UnorderedList>
      {variantList.access_permissions?.map((accessPermission) => {
        return (
          <ListItem key={accessPermission.uuid}>
            <Flex align="center" justify="space-between">
              <Text>{accessPermission.username}</Text>
              <HStack>
                <Menu>
                  <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                    {accessPermission.level}
                  </MenuButton>
                  <MenuList>
                    <MenuItem
                      onClick={() => {
                        setAccessLevel(
                          accessPermission.uuid,
                          VariantListAccessLevel.OWNER
                        );
                      }}
                    >
                      Owner
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAccessLevel(
                          accessPermission.uuid,
                          VariantListAccessLevel.EDITOR
                        );
                      }}
                    >
                      Editor
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setAccessLevel(
                          accessPermission.uuid,
                          VariantListAccessLevel.VIEWER
                        );
                      }}
                    >
                      Viewer
                    </MenuItem>
                  </MenuList>
                </Menu>
                <Button
                  onClick={() => {
                    removeAccess(accessPermission.uuid);
                  }}
                >
                  Remove
                </Button>
              </HStack>
            </Flex>
          </ListItem>
        );
      })}
    </UnorderedList>
  );
};

const deleteVariantList = (uuid: string): Promise<void> => {
  return del(`/variant-lists/${uuid}/`);
};

const VariantListPage = (props: { variantList: VariantList }) => {
  const [variantList, setVariantList] = useState(props.variantList);

  const history = useHistory();
  const { isOpen, onOpen, onClose } = useDisclosure();
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

      {variantList.access_level === VariantListAccessLevel.OWNER &&
        variantList.access_permissions && (
          <>
            <Heading as="h2" size="md" mb={2}>
              Sharing
            </Heading>
            <UnorderedList mb={4}>
              {variantList.access_permissions.map((accessPermission) => {
                return (
                  <ListItem key={accessPermission.username}>
                    {accessPermission.username}{" "}
                    <Badge>{accessPermission.level}</Badge>
                  </ListItem>
                );
              })}
            </UnorderedList>
            <HStack mb={4}>
              <Button onClick={onOpen}>Edit</Button>
            </HStack>
          </>
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

      <Modal isOpen={isOpen} size="2xl" onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sharing</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VariantListSharingSettings
              variantList={variantList}
              onChange={setVariantList}
            />
          </ModalBody>

          <ModalFooter>
            <Button onClick={onClose}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
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
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      setIsLoading(true);
      setVariantList(null);
      get(`/variant-lists/${uuid}/`)
        .then((response) => response.variant_list)
        .then((variantList) => {
          setVariantList(variantList);
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

    if (variantList) {
      return <Component variantList={variantList} />;
    }

    return null;
  };
};

const VariantListPageContainer = withVariantList(VariantListPage);

export default VariantListPageContainer;
