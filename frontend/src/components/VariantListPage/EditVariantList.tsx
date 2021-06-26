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
  Textarea,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";

import { patch } from "../../api";
import { Store, useStore } from "../../state";
import { VariantList } from "../../types";

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

interface EditVariantListFormProps {
  variantListStore: Store<VariantList>;
  onCancel: () => void;
  onSuccessfulEdit: () => void;
}

const EditVariantListForm = (props: EditVariantListFormProps) => {
  const { variantListStore, onSuccessfulEdit, onCancel } = props;
  const variantList = useStore(variantListStore);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState(variantList.label);
  const [description, setDescription] = useState(variantList.description);

  const toast = useToast();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (!isSubmitting) {
          setIsSubmitting(true);
          submitVariantList(variantList.uuid, {
            label,
            description,
          }).then(
            (updatedVariantList) => {
              variantListStore.set(updatedVariantList);
              onSuccessfulEdit();
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

        <FormControl id="edit-variant-list-description">
          <FormLabel>Description</FormLabel>
          <Textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          />
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
