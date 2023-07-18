import { AddIcon, EditIcon, ViewIcon } from "@chakra-ui/icons";
import {
  Button,
  ButtonProps,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Textarea,
  Tooltip,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";

import { VariantId } from "../../types";

interface VariantNoteFormProps {
  initialNote: string;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}

const VariantNoteForm = (props: VariantNoteFormProps) => {
  const { initialNote, onCancel, onSubmit } = props;
  const [note, setNote] = useState(initialNote);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note);
      }}
    >
      <VStack mb={4} spacing={4} align="flex-start">
        <FormControl id="edit-variant-note-note">
          <FormLabel>Note</FormLabel>
          <Textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
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

type VariantNoteProps = Omit<ButtonProps, "onClick"> & {
  variantId: VariantId;
  note: string | undefined;
  onEdit: (note: string) => void;
  userCanEdit: boolean;
};

export const VariantNote = (props: VariantNoteProps) => {
  const { variantId, note, onEdit, userCanEdit } = props;
  const hasNote = !!note;

  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      {!userCanEdit && (
        <>
          {hasNote && (
            <>
              <Tooltip
                hasArrow
                label={
                  <>
                    Note: <p>{note}</p>
                  </>
                }
              >
                <IconButton
                  aria-label={"View note"}
                  icon={<ViewIcon />}
                  size="sm"
                />
              </Tooltip>
            </>
          )}
        </>
      )}
      {userCanEdit && (
        <>
          <Tooltip
            hasArrow
            label={
              hasNote ? (
                <>
                  Edit note<p>{note}</p>
                </>
              ) : (
                "Add note"
              )
            }
          >
            <IconButton
              aria-label={hasNote ? "Edit note" : "Add note"}
              icon={hasNote ? <EditIcon /> : <AddIcon />}
              size="sm"
              onClick={onOpen}
            />
          </Tooltip>
          <Modal isOpen={isOpen} size="xl" onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>{variantId}</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VariantNoteForm
                  initialNote={note || ""}
                  onCancel={onClose}
                  onSubmit={(value) => {
                    onClose();
                    onEdit(value);
                  }}
                />
              </ModalBody>
            </ModalContent>
          </Modal>
        </>
      )}
    </>
  );
};
