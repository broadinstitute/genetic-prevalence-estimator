import {
  Button,
  ButtonProps,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Text,
  useDisclosure,
} from "@chakra-ui/react";

export interface ButtonWithConfirmationProps extends ButtonProps {
  confirmationPrompt: string;
  confirmButtonText?: string;
  confirmButtonColorScheme?: string;
  onClick: () => void;
}

const ButtonWithConfirmation = (props: ButtonWithConfirmationProps) => {
  const {
    confirmationPrompt,
    confirmButtonText = "Confirm",
    confirmButtonColorScheme = "red",
    onClick,
    ...rest
  } = props;

  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Button {...rest} onClick={onOpen} />

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Are you sure?</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>{confirmationPrompt}</Text>
          </ModalBody>

          <ModalFooter>
            <HStack>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                colorScheme={confirmButtonColorScheme}
                onClick={() => {
                  onClose();
                  onClick && onClick();
                }}
              >
                {confirmButtonText}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ButtonWithConfirmation;
