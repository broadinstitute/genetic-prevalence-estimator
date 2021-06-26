import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Button,
  Divider,
  Flex,
  HStack,
  ListItem,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
  UnorderedList,
  useToast,
} from "@chakra-ui/react";

import { del, patch, post } from "../../api";
import { authStore, useStore } from "../../state";
import { VariantList, VariantListAccessLevel } from "../../types";

import ShareVariantListForm from "./ShareVariantListForm";

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
      (newAccessPermission) => {
        onChange({
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

export default VariantListSharingSettings;
