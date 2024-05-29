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
  Tooltip,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { isVariantId } from "@gnomad/identifiers";
import { isStructuralVariantId } from "./identifiers";

export type InputVariant = {
  key: string;
  id: string;
};

type VariantsInputProps = {
  id: string;
  gnomadVersion: string;
  value: InputVariant[];
  onChange: (value: InputVariant[]) => void;
};

let counter = 0;
const nextKey = () => `${counter++}`;

const hasStructuralVariantPrefix = (id: string) => {
  const regex = /^(BND|CPX|CTX|DEL|DUP|INS|INV|CNV)/;
  return regex.test(id);
};

const VariantsInput = (props: VariantsInputProps) => {
  const { id, gnomadVersion, value: variants, onChange } = props;

  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <VStack spacing={4} align="flex-start" alignSelf="stretch">
        {variants.map((variant, i) => {
          const isValid =
            isVariantId(variant.id) ||
            isStructuralVariantId(variant.id, gnomadVersion);
          return (
            <FormControl
              key={variant.key}
              id={`${id}-variant-${variant.key}`}
              isInvalid={!!variant.id && !isValid}
              isRequired
            >
              <FormLabel>Variant #{i + 1}</FormLabel>
              <Flex align="center">
                <Input
                  flex={1}
                  value={variant.id}
                  onChange={(e) => {
                    onChange([
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
                      onChange([
                        ...variants.slice(0, i),
                        ...variants.slice(i + 1),
                      ]);
                    }}
                  />
                </Tooltip>
              </Flex>
              <FormErrorMessage>
                {hasStructuralVariantPrefix(variant.id)
                  ? gnomadVersion === "4.1.0"
                    ? "Expected SV ID in class-chrom-number format, e.g. DEL_CHR19_4BB4DFA2"
                    : "Expected SV ID in class-chrom-number format, e.g. DEL_19_169804"
                  : "Expected variant ID in chrom-pos-ref-alt format."}
              </FormErrorMessage>
            </FormControl>
          );
        })}

        <FormControl
          id={`${id}-num-variants`}
          isInvalid={variants.length === 0}
          isRequired
        >
          <Input type="hidden" value={variants.length} />
          <FormErrorMessage>Add at least one variant</FormErrorMessage>
        </FormControl>

        <HStack>
          <Button
            onClick={() => {
              onChange([...variants, { key: nextKey(), id: "" }]);
            }}
          >
            Add variant
          </Button>

          <Button onClick={onOpen}>Upload variants</Button>
        </HStack>
      </VStack>

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
                htmlFor={`${id}-upload-variants`}
                style={{ width: "100%" }}
              >
                Choose file
                <input
                  hidden
                  id={`${id}-upload-variants`}
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
                        const lines = result.replace(/\r\n/g, "\n").split("\n");
                        onChange(
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

export default VariantsInput;
