import { Box, Heading, Text, useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { get, del, post } from "../../api";
import { renderErrorDescription } from "../../errors";
import { authStore, useStore } from "../../state";

import ButtonWithConfirmation from "../ButtonWithConfirmation";

const publicStatusOptions = {
  private: <Text>Private</Text>,
  pending: <Text>pending</Text>,
  public: <Text>public</Text>,
  rejected: <Text>rejected</Text>,
};

const VariantListPublicStatus = ({ variantListUuid }: any) => {
  const [publicListEntry, setPublicListEntry] = useState({
    approval_status: "Private",
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useStore(authStore);
  const [error, setError] = useState<Error | null>(null);
  const toast = useToast();

  useEffect(() => {
    setIsLoading(true);
    get("/public-variant-lists/").then((publicVariantLists) => {
      // TODO: REMOVE THIS IGNORE
      // @ts-ignore
      const finalList = publicVariantLists.filter(
        (list: any) => list.variant_list.uuid === variantListUuid
      );

      if (finalList.length > 0) {
        setPublicListEntry(finalList[0]);
      } else {
        setPublicListEntry({ approval_status: "Private" });
      }
    });
  }, [variantListUuid]);

  return (
    <Box mb={4}>
      <Heading as="h2" size="md" mb={2}>
        Publicity
      </Heading>
      <Text
        mb={2}
      >{`This variant list is ${publicListEntry.approval_status}`}</Text>
      {/* TODO: change this later */}
      {publicListEntry.approval_status === "Private" && (
        <ButtonWithConfirmation
          size="sm"
          colorScheme="blue"
          confirmationPrompt="Publication requires staff approval"
          confirmButtonText="Make public"
          confirmButtonColorScheme="blue"
          onClick={() => {
            const request = {
              variant_list: variantListUuid,
              submitted_by: user?.username,
            };
            post("/public-variant-lists/", request)
              .then((response) => {
                toast({
                  title: "Public status updated",
                  status: "success",
                  duration: 30_000,
                  isClosable: true,
                });
                setPublicListEntry({ approval_status: "Pending" });
              })
              .catch((error) => {
                toast({
                  title: "Unable to update public status",
                  description: "A public list for this gene may already exist",
                  status: "error",
                  duration: 10_000,
                  isClosable: true,
                });
              });
          }}
        >
          Make public
        </ButtonWithConfirmation>
      )}

      {/* TODO: add permissions to that either admins OR anyone who can view this lsit can delete it */}
      {publicListEntry.approval_status !== "Private" && (
        <ButtonWithConfirmation
          size="sm"
          colorScheme="red"
          confirmationPrompt="To make this list public again, it will have to be reapproved."
          confirmButtonText="Make private"
          confirmButtonColorScheme="red"
          onClick={() => {
            // @ts-ignore
            del(`/public-variant-lists/${publicListEntry.uuid}`).then(
              () => {
                toast({
                  title: "Variant is now private",
                  status: "success",
                  duration: 30_000,
                  isClosable: true,
                });
                setPublicListEntry({ approval_status: "Private" });
              },
              (error) => {
                toast({
                  title: "Unable to make the list private",
                  description: renderErrorDescription(error),
                  status: "error",
                  duration: 10_000,
                  isClosable: true,
                });
              }
            );
            // TODO: add failure
          }}
        >
          Make private
        </ButtonWithConfirmation>
      )}
    </Box>
  );
};

export default VariantListPublicStatus;
