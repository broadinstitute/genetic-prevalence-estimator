import {
  Alert,
  AlertIcon,
  Box,
  Button,
  HStack,
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

import { post } from "../../api";
import { VariantList, VariantListAccessLevel } from "../../types";

const reprocessVariantList = (uuid: string): Promise<void> => {
  return post(`/variant-lists/${uuid}/process/`, {});
};

interface VariantListErrorStatusProps {
  variantList: VariantList;
  refreshVariantList: () => void;
}

const VariantListErrorStatus = (props: VariantListErrorStatusProps) => {
  const { variantList, refreshVariantList } = props;

  const userCanEdit =
    variantList.access_level === VariantListAccessLevel.EDITOR ||
    variantList.access_level === VariantListAccessLevel.OWNER;

  const { isOpen, onOpen, onClose } = useDisclosure();

  const retry = () => {
    reprocessVariantList(variantList.uuid).then(() => {
      refreshVariantList();
    });
  };

  return (
    <>
      <Alert status="error" mb={4}>
        <AlertIcon />
        <Box flex="1">
          <Text mb={variantList.error ? 2 : undefined}>
            There was an error processing this variant list.
          </Text>
          <HStack>
            {variantList.error && (
              <Button size="sm" colorScheme="red" onClick={onOpen}>
                See details
              </Button>
            )}
            {userCanEdit && (
              <Button
                size="sm"
                colorScheme="red"
                onClick={() => {
                  retry();
                }}
              >
                Retry
              </Button>
            )}
          </HStack>
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

interface VariantListStatusProps {
  variantList: VariantList;
  refreshVariantList: () => void;
}

const VariantListStatus = (props: VariantListStatusProps) => {
  const { variantList, refreshVariantList } = props;

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
    return (
      <VariantListErrorStatus
        variantList={variantList}
        refreshVariantList={refreshVariantList}
      />
    );
  }

  return null;
};

export default VariantListStatus;
