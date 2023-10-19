import {
  FormControl,
  FormLabel,
  HStack,
  Radio,
  RadioGroup,
  Text,
} from "@chakra-ui/react";

export type AnnotationOption = "shared" | "personal";

type AnnotationTypeSelectorProps = {
  userCanEdit: boolean;
  value: AnnotationOption;
  onChange: (value: AnnotationOption) => void;
};

const AnnotationTypeSelector = (props: AnnotationTypeSelectorProps) => {
  const { userCanEdit, value, onChange } = props;

  return (
    <>
      {!userCanEdit && <Text>Viewing shared annotations</Text>}
      {userCanEdit && (
        <FormControl id="annotation-type-selector" as="fieldset">
          <FormLabel as="legend">Annotation type</FormLabel>
          <RadioGroup
            value={value}
            onChange={(value: AnnotationOption) => {
              onChange(value);
            }}
          >
            <HStack spacing="24px">
              <Radio value="shared">Shared</Radio>
              <Radio value="personal">Personal</Radio>
            </HStack>
          </RadioGroup>
        </FormControl>
      )}
    </>
  );
};

export default AnnotationTypeSelector;
