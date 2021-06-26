import {
  Alert,
  AlertIcon,
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { patch } from "../../api";
import { VariantList, VariantListAccessLevel } from "../../types";

import { withVariantList } from "./VariantListPage";

interface VariantListPatch {
  label: string;
  description: string;
}

const submitVariantList = (
  uuid: string,
  patchData: VariantListPatch
): Promise<VariantList> => {
  return patch(`/variant-lists/${uuid}/`, patchData);
};

const EditVariantListPage = ({ variantList }: { variantList: VariantList }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState(variantList.label);
  const [description, setDescription] = useState(variantList.description);

  const history = useHistory();
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
          <BreadcrumbItem>
            <BreadcrumbLink
              as={RRLink}
              to={`/variant-lists/${variantList.uuid}/`}
            >
              {variantList.label}
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <span>Edit</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        {variantList.label}
      </Heading>

      {userCanEdit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();

            if (!isSubmitting) {
              setIsSubmitting(true);
              submitVariantList(variantList.uuid, {
                label,
                description,
              }).then(
                (variantList) => {
                  history.push(`/variant-lists/${variantList.uuid}/`);
                },
                (error) => {
                  setIsSubmitting(false);
                  toast({
                    title: "Unable to edit variant list",
                    description: error.message,
                    status: "error",
                    duration: 10000,
                    isClosable: true,
                  });
                }
              );
            }
          }}
        >
          <VStack spacing={4} align="flex-start">
            <FormControl
              id="edit-variant-list-label"
              isInvalid={label.length === 0}
              isRequired
            >
              <FormLabel>Label</FormLabel>
              <Input
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                }}
              />
              <FormErrorMessage>A label is required.</FormErrorMessage>
            </FormControl>

            <FormControl id="edit-variant-list-description">
              <FormLabel>Description</FormLabel>
              <Textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
              />
            </FormControl>

            <HStack>
              <Button colorScheme="blue" type="submit">
                Submit
              </Button>
              <Button as={RRLink} to={`/variant-lists/${variantList.uuid}`}>
                Cancel
              </Button>
            </HStack>
          </VStack>
        </form>
      ) : (
        <Alert status="error">
          <AlertIcon />
          You do not have permission to edit this variant list.
        </Alert>
      )}
    </>
  );
};

const EditVariantListPageContainer = withVariantList(EditVariantListPage);

export default EditVariantListPageContainer;
