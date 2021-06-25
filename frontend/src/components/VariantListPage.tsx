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
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
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
  Select,
  Spinner,
  Text,
  UnorderedList,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { del, get, patch, post } from "../api";
import { authStore, useStore } from "../state";
import { VariantList, VariantListAccessLevel } from "../types";

import ButtonWithConfirmation from "./ButtonWithConfirmation";
import DateTime from "./DateTime";
import { DescriptionList, DescriptionListItem } from "./DescriptionList";

interface ShareVariantListFormValue {
  username: string;
  level: VariantListAccessLevel;
}

interface ShareVariantListFormProps {
  onSubmit: (value: ShareVariantListFormValue) => void;
}

const ShareVariantListForm = (props: ShareVariantListFormProps) => {
  const { onSubmit } = props;

  const [username, setUsername] = useState("");
  const [level, setLevel] = useState("Viewer");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        onSubmit({
          level: level as VariantListAccessLevel,
          username,
        });

        setUsername("");
      }}
    >
      <HStack align="flex-end">
        <FormControl id="share-variant-list-user" flexGrow={1}>
          <FormLabel>User</FormLabel>
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
            }}
          />
        </FormControl>

        <FormControl id="share-variant-list-level" width={300}>
          <FormLabel>Access level</FormLabel>
          <Select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
            }}
          >
            <option value="Viewer">Viewer</option>
            <option value="Editor">Editor</option>
            <option value="Owner">Owner</option>
          </Select>
        </FormControl>

        <Button colorScheme="blue" type="submit" flexShrink={0}>
          Submit
        </Button>
      </HStack>
    </form>
  );
};

const VariantListSharingSettings = (props: {
  variantList: VariantList;
  onChange: (variantList: VariantList) => void;
}) => {
  const { variantList, onChange } = props;

  const { user } = useStore(authStore);

  const toast = useToast();

  const shareVariantList = ({
    username,
    level,
  }: {
    username: string;
    level: VariantListAccessLevel;
  }): Promise<void> => {
    return post("/variant-list-access/", {
      variant_list: variantList.uuid,
      user: username,
      level,
    }).then(
      (response) => {
        onChange({
          ...variantList,
          access_permissions: [
            ...(variantList.access_permissions || []),
            response.variant_list_access,
          ],
        });
      },
      (error) => {
        toast({
          title: "Unable to share variant list",
          description: error.message,
          status: "error",
          duration: 10000,
          isClosable: true,
        });
      }
    );
  };

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
    <>
      <Text mb={2}>Collaborators</Text>
      <UnorderedList>
        {variantList.access_permissions?.map((accessPermission) => {
          return (
            <ListItem key={accessPermission.uuid} mb={2}>
              <Flex align="center" justify="space-between">
                <Text>{accessPermission.username}</Text>
                <HStack>
                  <Menu>
                    <MenuButton
                      as={Button}
                      disabled={accessPermission.username === user?.username}
                      rightIcon={<ChevronDownIcon />}
                    >
                      {accessPermission.level}
                    </MenuButton>
                    <MenuList>
                      {[
                        [VariantListAccessLevel.OWNER, "Owner"],
                        [VariantListAccessLevel.EDITOR, "Editor"],
                        [VariantListAccessLevel.VIEWER, "Viewer"],
                      ].map(([level, label]) => {
                        return (
                          <MenuItem
                            onClick={() => {
                              setAccessLevel(
                                accessPermission.uuid,
                                level as VariantListAccessLevel
                              );
                            }}
                          >
                            {label}
                          </MenuItem>
                        );
                      })}
                    </MenuList>
                  </Menu>
                  <Button
                    disabled={accessPermission.username === user?.username}
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
      <Divider mb={4} mt={4} />
      <Text mb={2}>Add a collaborator</Text>
      <ShareVariantListForm onSubmit={shareVariantList} />
    </>
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
                  <ListItem key={accessPermission.username} mb={2}>
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
        .then(setVariantList, setError)
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
