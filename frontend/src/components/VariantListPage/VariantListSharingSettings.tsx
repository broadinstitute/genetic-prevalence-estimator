import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Button,
  ButtonProps,
  Divider,
  Flex,
  HStack,
  List,
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
  Text,
  UnorderedList,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";

import { del, patch, post } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, authStore, useStore } from "../../state";
import { VariantList, VariantListAccessLevel } from "../../types";

import ShareVariantListForm from "./ShareVariantListForm";

export const accessLevelDescriptions = {
  [VariantListAccessLevel.OWNER]:
    "Owners can edit the list, manage collaborators, and delete the list.",
  [VariantListAccessLevel.EDITOR]:
    "Editors can rename the list name and edit notes.",
  [VariantListAccessLevel.VIEWER]:
    "Viewers can only view and download the list.",
};

interface VariantListSharingSettingsProps {
  variantListStore: Store<VariantList>;
}

export const VariantListSharingSettings = (
  props: VariantListSharingSettingsProps
) => {
  const { variantListStore } = props;
  const variantList = useStore(variantListStore);

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
      (newAccessPermission) => {
        variantListStore.set({
          ...variantList,
          access_permissions: [
            ...(variantList.access_permissions || []),
            newAccessPermission,
          ],
        });
      },
      (error) => {
        toast({
          title: "Unable to share variant list",
          description: renderErrorDescription(error),
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
        variantListStore.set({
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
          description: renderErrorDescription(error),
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
        variantListStore.set({
          ...variantList,
          access_permissions: variantList.access_permissions?.filter(
            (accessPermission) => accessPermission.uuid !== uuid
          ),
        });
      },
      (error) => {
        toast({
          title: "Unable to remove access",
          description: renderErrorDescription(error),
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
      <List mb={2}>
        <ListItem>
          {accessLevelDescriptions[VariantListAccessLevel.OWNER]}
        </ListItem>
        <ListItem>
          {accessLevelDescriptions[VariantListAccessLevel.EDITOR]}
        </ListItem>
        <ListItem>
          {accessLevelDescriptions[VariantListAccessLevel.VIEWER]}
        </ListItem>
      </List>
      <UnorderedList>
        {variantList.access_permissions?.map((accessPermission) => {
          return (
            <ListItem key={accessPermission.uuid} mb={2}>
              <Flex align="center" justify="space-between">
                <Text>{accessPermission.user}</Text>
                <HStack>
                  <Menu>
                    <MenuButton
                      as={Button}
                      disabled={accessPermission.user === user?.username}
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
                            key={level}
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
                    disabled={accessPermission.user === user?.username}
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

export const VariantListSharingButton = (
  props: Omit<ButtonProps, "onClick"> & VariantListSharingSettingsProps
) => {
  const { variantListStore, ...otherProps } = props;

  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Button {...otherProps} onClick={onOpen} />
      <Modal isOpen={isOpen} size="2xl" onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sharing</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VariantListSharingSettings variantListStore={variantListStore} />
          </ModalBody>

          <ModalFooter>
            <Button onClick={onClose}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
