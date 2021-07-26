import {
  Button,
  CloseButton,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Radio,
  RadioGroup,
  Textarea,
  Tooltip,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { post } from "../../api";
import {
  CustomVariantListRequest,
  CustomVariantList,
  ReferenceGenome,
} from "../../types";

const submitVariantList = (
  request: CustomVariantListRequest
): Promise<CustomVariantList> => {
  return post("/variant-lists/", request);
};

interface InputVariant {
  key: string;
  id: string;
}

let counter = 0;
const nextKey = () => `${counter++}`;

const CustomVariantListForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [referenceGenome, setReferenceGenome] = useState("GRCh38");
  const [variants, setVariants] = useState<InputVariant[]>([]);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const history = useHistory();
  const toast = useToast();

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();

          const variantListRequest: CustomVariantListRequest = {
            label,
            notes,
            type: "custom",
            metadata: {
              version: "1",
              reference_genome: referenceGenome as ReferenceGenome,
            },
            variants: variants.map(({ id }) => ({ id })),
          };

          if (!isSubmitting) {
            setIsSubmitting(true);
            submitVariantList(variantListRequest).then(
              (variantList) => {
                history.push(`/variant-lists/${variantList.uuid}/`);
              },
              (error) => {
                setIsSubmitting(false);
                toast({
                  title: "Unable to create variant list",
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
          <FormControl id="custom-variant-list-label" isRequired>
            <FormLabel>Label</FormLabel>
            <Input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
              }}
            />
          </FormControl>

          <FormControl id="custom-variant-list-notes">
            <FormLabel>Notes</FormLabel>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
            />
          </FormControl>

          <FormControl id="custom-variant-list-reference-genome" isRequired>
            <FormLabel>Reference genome</FormLabel>
            <RadioGroup value={referenceGenome} onChange={setReferenceGenome}>
              <VStack align="flex-start">
                <Radio value="GRCh38">GRCh38</Radio>
                <Radio value="GRCh37">GRCh37</Radio>
              </VStack>
            </RadioGroup>
          </FormControl>

          {variants.map((variant, i) => {
            const isValid = /(\d{1,2}|X|Y)-\d+-[ACGT]+-[ACGT]+/.test(
              variant.id
            );
            return (
              <FormControl
                key={variant.key}
                id={`custom-variant-list-variant-${variant.key}`}
                isInvalid={!!variant.id && !isValid}
                isRequired
              >
                <FormLabel>Variant #{i + 1}</FormLabel>
                <Flex align="center">
                  <Input
                    flex={1}
                    value={variant.id}
                    onChange={(e) => {
                      setVariants([
                        ...variants.slice(0, i),
                        { ...variant, id: e.target.value },
                        ...variants.slice(i + 1),
                      ]);
                    }}
                  />
                  <Tooltip hasArrow label="Remove variant">
                    <CloseButton
                      aria-label="Remove variant"
                      ml="1ch"
                      onClick={() => {
                        setVariants([
                          ...variants.slice(0, i),
                          ...variants.slice(i + 1),
                        ]);
                      }}
                    />
                  </Tooltip>
                </Flex>
                <FormErrorMessage>
                  Expected variant ID in chrom-pos-ref-alt format.
                </FormErrorMessage>
              </FormControl>
            );
          })}

          <FormControl
            id="custom-variant-list-variants"
            isInvalid={variants.length === 0}
            isRequired
          >
            <Input type="hidden" value={variants.length} />
            <FormErrorMessage>Add at least one variant</FormErrorMessage>
          </FormControl>

          <HStack>
            <Button
              onClick={() => {
                setVariants([...variants, { key: nextKey(), id: "" }]);
              }}
            >
              Add variant
            </Button>

            <Button onClick={onOpen}>Upload variants</Button>
          </HStack>

          <HStack>
            <Button colorScheme="blue" type="submit">
              Submit
            </Button>
            <Button as={RRLink} to="/variant-lists/">
              Cancel
            </Button>
          </HStack>
        </VStack>
      </form>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload variants</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <p style={{ marginBottom: "1em" }}>
                Uploaded file should contain one variant ID per line.
              </p>
              <Button
                as="label"
                htmlFor="variants-file"
                style={{ width: "100%" }}
              >
                Choose file
                <input
                  hidden
                  id="variants-file"
                  type="file"
                  onChange={(e) => {
                    const files = e.target?.files;
                    if (!files || files.length === 0) {
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const result = e.target?.result as string;
                      if (result) {
                        const lines = result.split("\n");
                        setVariants(
                          lines.filter(Boolean).map((line) => ({
                            key: nextKey(),
                            id: line,
                          }))
                        );
                      }
                    };
                    reader.readAsText(files[0]);

                    onClose();
                  }}
                />
              </Button>
            </form>
          </ModalBody>

          <ModalFooter>
            <Button mr={3} onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CustomVariantListForm;
