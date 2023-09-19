import { Box, Heading, Text, useToast } from "@chakra-ui/react";

import ButtonWithConfirmation from "../ButtonWithConfirmation";

import { patch } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, useStore } from "../../state";
import { VariantList, VariantListReviewStatusCode } from "../../types";

const VariantListReviewStatus = ({
  variantListStore,
}: {
  variantListStore: Store<VariantList>;
}) => {
  const variantList: VariantList = useStore(variantListStore);
  const toast = useToast();

  const makeVariantListPublic = () => {
    patch(`/public-variant-lists/${variantList.uuid}/`, { public_status: "P" })
      .then((response) => {
        toast({
          title: "Public status updated",
          status: "success",
          duration: 30_000,
          isClosable: true,
        });
        variantListStore.set({
          ...variantList,
          public_status: VariantListReviewStatusCode.PENDING,
        });
      })
      .catch(() => {
        toast({
          title: "Unable to update public status",
          description: `An approved public variant list for this gene may already exist.`,
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      });
  };

  const makeVariantListPrivate = () => {
    patch(`/public-variant-lists/${variantList.uuid}/`, { public_status: "" })
      .then(() => {
        toast({
          title: "The variant list is now private",
          status: "success",
          duration: 30_000,
          isClosable: true,
        });
        variantListStore.set({
          ...variantList,
          public_status: "",
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
  };

  return (
    <Box mb={4}>
      <Heading as="h2" size="md" mb={2}>
        Publicity
      </Heading>
      <Text mb={2}>{`This variant list is ${
        variantList.public_status
          ? variantList.public_status.toLowerCase()
          : "private"
      }`}</Text>
      {variantList.public_status === "" && (
        <ButtonWithConfirmation
          size="sm"
          confirmationPrompt="Publication requires staff approval"
          confirmButtonText="Make public"
          confirmButtonColorScheme="blue"
          onClick={() => makeVariantListPublic()}
        >
          Make public
        </ButtonWithConfirmation>
      )}

      {variantList.public_status !== "" && (
        <ButtonWithConfirmation
          size="sm"
          colorScheme="red"
          confirmationPrompt="To make this list public again, it will have to be reapproved."
          confirmButtonText="Make private"
          confirmButtonColorScheme="red"
          onClick={() => makeVariantListPrivate()}
        >
          Make private
        </ButtonWithConfirmation>
      )}
    </Box>
  );
};

export default VariantListReviewStatus;
