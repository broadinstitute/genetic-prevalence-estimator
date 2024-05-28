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

  const makeVariantListRepresentative = () => {
    patch(`/public-variant-lists/${variantList.uuid}/`, {
      representative_status: "P",
    })
      .then((response) => {
        toast({
          title: "Representative status updated",
          status: "success",
          duration: 3_000,
          isClosable: true,
        });
        variantListStore.set({
          ...variantList,
          representative_status: VariantListReviewStatusCode.PENDING,
        });
      })
      .catch(() => {
        toast({
          title: "Unable to update representative status",
          description: `An approved representative variant list for this gene may already exist.`,
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      });
  };

  const makeVariantListPrivate = () => {
    patch(`/public-variant-lists/${variantList.uuid}/`, {
      representative_status: "",
    })
      .then(() => {
        toast({
          title: "The variant list is now not representative",
          status: "success",
          duration: 3_000,
          isClosable: true,
        });
        variantListStore.set({
          ...variantList,
          representative_status: "",
        });
      })
      .catch((error) => {
        toast({
          title: "Unable to edit variant list representivity",
          description: renderErrorDescription(error),
          status: "error",
          duration: 10_000,
          isClosable: true,
        });
      });
  };

  const representativeStatusToWordingMap = {
    Pending: "This list is pending approval to be represented on the dashboard",
    Rejected: "This list was not chosen to be on the dashboard",
    Approved: "This list is currently represented on the dashboard",
  };

  return (
    <Box mb={4}>
      <Heading as="h2" size="md" mb={2}>
        Representivity
      </Heading>
      <Text mb={2}>
        {variantList.representative_status
          ? representativeStatusToWordingMap[variantList.representative_status]
          : "This list is not currently represented on the dashboard"}
      </Text>
      {variantList.representative_status === "" && (
        <ButtonWithConfirmation
          size="sm"
          confirmationPrompt="Inclusion on the dashboard requires staff approval. Approved representative lists are public to view by any user of the website, this includes the emails of any associated owners of the list."
          confirmButtonText="Make representative"
          confirmButtonColorScheme="blue"
          onClick={() => makeVariantListRepresentative()}
        >
          Apply to be included on the dashboard
        </ButtonWithConfirmation>
      )}

      {variantList.representative_status !== "" && (
        <ButtonWithConfirmation
          size="sm"
          colorScheme="red"
          confirmationPrompt="To make this list representative again, it will have to be reapproved."
          confirmButtonText="Make not representative"
          confirmButtonColorScheme="red"
          onClick={() => makeVariantListPrivate()}
        >
          Make not representative
        </ButtonWithConfirmation>
      )}
    </Box>
  );
};

export default VariantListReviewStatus;
