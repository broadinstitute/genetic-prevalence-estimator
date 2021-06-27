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
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";

interface NewUser {
  username: string;
}

interface NewUserFormProps {
  onCancel: () => void;
  onSubmit: (newUser: NewUser) => void;
}

const NewUserForm = (props: NewUserFormProps) => {
  const { onCancel, onSubmit } = props;

  const [username, setUsername] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (username) {
          onSubmit({ username });
        }
      }}
    >
      <VStack mb={4} spacing={4} align="flex-start">
        <FormControl
          id="new-user-username"
          isInvalid={username.length === 0}
          isRequired
        >
          <FormLabel>Username</FormLabel>
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
            }}
          />
          <FormErrorMessage>A username is required.</FormErrorMessage>
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

export const AddUserButton = (
  props: Omit<ButtonProps, "onClick"> & {
    onAddUser: (newUser: NewUser) => void;
  }
) => {
  const { onAddUser, ...otherProps } = props;

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
            <NewUserForm
              onSubmit={(newUser) => {
                onClose();
                onAddUser(newUser);
              }}
              onCancel={onClose}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};
