import { Box, Heading, Text, useToast } from "@chakra-ui/react";

import ButtonWithConfirmation from "../ButtonWithConfirmation";

import { del, post } from "../../api";
import { renderErrorDescription } from "../../errors";
import { authStore, Store, useStore } from "../../state";
import { VariantList, VariantListPublicStatusCode } from "../../types";

const VariantListPublicStatus = ({
  variantListStore,
}: {
  variantListStore: Store<VariantList>;
}) => {
  const variantList: VariantList = useStore(variantListStore);
  const { user } = useStore(authStore);
  const toast = useToast();

  return (
    <Box mb={4}>
      <Heading as="h2" size="md" mb={2}>
        Publicity
      </Heading>
      <Text mb={2}>{`This variant list is ${
        variantList.public_status
          ? variantList.public_status.public_status.toLowerCase()
          : "private"
      }`}</Text>
      {!variantList.public_status && (
        <ButtonWithConfirmation
          size="sm"
          confirmationPrompt="Publication requires staff approval"
          confirmButtonText="Make public"
          confirmButtonColorScheme="blue"
          onClick={() => {
            const request = {
              variant_list: variantList.uuid,
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
                variantListStore.set({
                  ...variantList,
                  public_status: {
                    ...response,
                    public_status: VariantListPublicStatusCode.SUBMITTED,
                  },
                });
              })
              .catch((error) => {
                toast({
                  title: "Unable to update public status",
                  description: `An approved public variant list for this gene may already exist.`,
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

      {variantList.public_status && (
        <ButtonWithConfirmation
          size="sm"
          colorScheme="red"
          confirmationPrompt="To make this list public again, it will have to be reapproved."
          confirmButtonText="Make private"
          confirmButtonColorScheme="red"
          onClick={() => {
            del(
              // @ts-ignore -- the conditional check above guarantees variantList has a public_status
              `/public-variant-lists/${variantList.public_status.variant_list}`
            )
              .then(() => {
                toast({
                  title: "Variant is now private",
                  status: "success",
                  duration: 30_000,
                  isClosable: true,
                });
                variantListStore.set({
                  ...variantList,
                  public_status: undefined,
                });
              })
              .catch((error) => {
                toast({
                  title: "Unable to make the list private",
                  description: renderErrorDescription(error),
                  status: "error",
                  duration: 10_000,
                  isClosable: true,
                });
              });
          }}
        >
          Make private
        </ButtonWithConfirmation>
      )}
    </Box>
  );
};

export default VariantListPublicStatus;
