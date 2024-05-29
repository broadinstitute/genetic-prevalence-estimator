import {
  Button,
  ButtonProps,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Textarea,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";

import { patch } from "../../api";
import { renderErrorDescription } from "../../errors";
import { Store, useStore } from "../../state";
import { VariantList } from "../../types";

interface VariantListPatch {
  label: string;
  notes: string;
  is_public: boolean;
  supporting_documents: {
    title: string;
    url: string;
  }[];
}

const submitVariantList = (
  uuid: string,
  patchData: VariantListPatch
): Promise<VariantList> => {
  return patch(`/variant-lists/${uuid}/`, patchData);
};

interface EditVariantListFormProps {
  variantListStore: Store<VariantList>;
  onCancel: () => void;
  onSuccessfulEdit: () => void;
}

const isValidURL = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

const EditVariantListForm = (props: EditVariantListFormProps) => {
  const { variantListStore, onSuccessfulEdit, onCancel } = props;
  const variantList = useStore(variantListStore);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState(variantList.label);
  const [notes, setNotes] = useState(variantList.notes);
  const [isPublic, setIsPublic] = useState(variantList.is_public);
  const [supportingDocument, setSupportingDocument] = useState(
    variantList.supporting_documents[0] || { title: "", url: "" }
  );

  const supportingDocumentIsValid =
    (supportingDocument.title === "" && supportingDocument.url === "") ||
    (supportingDocument.title !== "" && isValidURL(supportingDocument.url));

  const toast = useToast();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (!isSubmitting) {
          setIsSubmitting(true);
          submitVariantList(variantList.uuid, {
            label,
            notes,
            is_public: isPublic,
            supporting_documents:
              supportingDocument.title && supportingDocument.url
                ? [supportingDocument]
                : [],
          }).then(
            (updatedVariantList) => {
              variantListStore.set(updatedVariantList);
              toast({
                title: "Edited variant list",
                status: "success",
                duration: 1_000,
                isClosable: true,
              });
              onSuccessfulEdit();
            },
            (error) => {
              setIsSubmitting(false);
              toast({
                title: "Unable to edit variant list",
                description: renderErrorDescription(error),
                status: "error",
                duration: 10_000,
                isClosable: true,
              });
            }
          );
        }
      }}
    >
      <VStack mb={4} spacing={4} align="flex-start">
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

        <FormControl id="edit-variant-list-notes">
          <FormLabel>Notes</FormLabel>
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
          />
        </FormControl>

        <FormControl id="edit-variant-list-publicity">
          <FormLabel>Publicity</FormLabel>
          <Select
            value={isPublic.toString()}
            onChange={(e) => {
              setIsPublic(e.target.value === "true");
            }}
          >
            <option value="true">Public</option>
            <option value="false">Private</option>
          </Select>
        </FormControl>

        <FormControl
          id="edit-variant-list-supporting-document"
          isInvalid={!supportingDocumentIsValid}
        >
          <FormLabel>Supporting document</FormLabel>
          <Input
            mb={2}
            placeholder={"title"}
            value={supportingDocument.title}
            onChange={(e) => {
              setSupportingDocument({
                title: e.target.value,
                url: supportingDocument.url,
              });
            }}
          />
          <Input
            placeholder={"url"}
            value={supportingDocument.url}
            onChange={(e) => {
              setSupportingDocument({
                title: supportingDocument.title,
                url: e.target.value,
              });
            }}
          />
          <FormErrorMessage>
            A supporting documnent must have a non-empty title and a valid URL
          </FormErrorMessage>
        </FormControl>

        <HStack justify="flex-end" width="100%">
          <Button onClick={onCancel}>Cancel</Button>
          <Button colorScheme="blue" type="submit">
            Submit
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};

export const EditVariantListButton = (
  props: Omit<ButtonProps, "onClick"> &
    Omit<EditVariantListFormProps, "onSuccessfulEdit" | "onCancel">
) => {
  const { variantListStore, ...otherProps } = props;

  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Button {...otherProps} onClick={onOpen} />
      <Modal isOpen={isOpen} size="2xl" onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <EditVariantListForm
              variantListStore={variantListStore}
              onSuccessfulEdit={onClose}
              onCancel={onClose}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};
