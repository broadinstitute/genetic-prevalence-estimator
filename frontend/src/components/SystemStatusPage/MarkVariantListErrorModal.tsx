import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";

import { post } from "../../api";

import { SystemStatusVariantList } from "./VariantListStatusTable";

const DEFAULT_MESSAGE =
  "Not processed: this list was queued but never picked up for processing. Use Retry to process it.";

const MAX_MESSAGE_LENGTH = 1000;

const markVariantListAsErrored = (uuid: string, message: string) => {
  return post(`/variant-lists/${uuid}/mark-error/`, { message });
};

const MarkVariantListErrorModal = ({
  variantList,
  onClose,
  onMarked,
}: {
  variantList: SystemStatusVariantList;
  onClose: () => void;
  onMarked: () => void;
}) => {
  const toast = useToast();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmedMessage = message.trim();
  const isMessageValid =
    trimmedMessage.length > 0 && trimmedMessage.length <= MAX_MESSAGE_LENGTH;

  const submit = () => {
    setIsSubmitting(true);
    setSubmitError(null);
    markVariantListAsErrored(variantList.uuid, trimmedMessage).then(
      () => {
        toast({
          title: `Marked "${variantList.label}" as errored`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        onMarked();
        onClose();
      },
      (error: Error) => {
        setIsSubmitting(false);
        setSubmitError(error.message);
      }
    );
  };

  return (
    <Modal isOpen size="xl" onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Mark "{variantList.label}" as errored</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl id="mark-variant-list-error-message">
            <FormLabel>Message</FormLabel>
            <Textarea
              value={message}
              rows={4}
              onChange={(event) => {
                setMessage(event.target.value);
              }}
            />
            <FormHelperText>
              Shown to everyone who can view this list, as a staff note at the
              top of its notes. Also saved as the list's error with your
              username. {trimmedMessage.length}/{MAX_MESSAGE_LENGTH} characters.
            </FormHelperText>
          </FormControl>
          {submitError && (
            <Text mt={4} role="alert">
              ✕ Unable to mark as errored: {submitError}
            </Text>
          )}
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              colorScheme="blue"
              isDisabled={!isMessageValid}
              isLoading={isSubmitting}
              onClick={submit}
            >
              Mark as errored
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MarkVariantListErrorModal;
