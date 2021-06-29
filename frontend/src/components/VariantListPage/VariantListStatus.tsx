import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from "@chakra-ui/react";

import { VariantList } from "../../types";

const VariantListErrorStatus = (props: { variantList: VariantList }) => {
  const { variantList } = props;

  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Alert status="error" mb={4}>
        <AlertIcon />
        <Box flex="1">
          <Text mb={variantList.error ? 2 : undefined}>
            There was an error processing this variant list.
          </Text>
          {variantList.error && (
            <Button size="sm" colorScheme="red" onClick={onOpen}>
              See details
            </Button>
          )}
        </Box>
      </Alert>
      {variantList.error && (
        <Modal isOpen={isOpen} size="full" onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Error details</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text background="gray.100" as="pre" p={2}>
                {variantList.error}
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button onClick={onClose}>Ok</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};

const VariantListStatus = (props: { variantList: VariantList }) => {
  const { variantList } = props;

  if (variantList.status === "Queued") {
    return (
      <Alert status="info" mb={4}>
        <AlertIcon />
        This variant list is queued for processing. It may be a while before it
        is ready. This page will automatically update when it is ready.
      </Alert>
    );
  }

  if (variantList.status === "Processing") {
    return (
      <Alert status="info" mb={4}>
        <AlertIcon />
        This variant list is currently processing. It should be ready shortly.
        This page will automatically update when it is ready.
      </Alert>
    );
  }

  if (variantList.status === "Error") {
    return <VariantListErrorStatus variantList={variantList} />;
  }

  return null;
};

export default VariantListStatus;
