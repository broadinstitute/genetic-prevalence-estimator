import {
  FormControl,
  FormLabel,
  HStack,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";

export type CarrierFrequencyModel = "full" | "simplified";

interface CarrierFrequencyModelInputProps {
  value: CarrierFrequencyModel;
  onChange: (value: CarrierFrequencyModel) => void;
}

export const CarrierFrequencyModelInput = (
  props: CarrierFrequencyModelInputProps
) => {
  const { value, onChange } = props;
  return (
    <FormControl id="carrier-frequency-model" as="fieldset">
      <FormLabel as="legend">Carrier frequency model</FormLabel>
      <RadioGroup
        value={value}
        onChange={(value) => {
          onChange(value as CarrierFrequencyModel);
        }}
      >
        <HStack spacing="24px">
          <Radio value="full">Full (2pq)</Radio>
          <Radio value="simplified">Simplified (2q)</Radio>
        </HStack>
      </RadioGroup>
    </FormControl>
  );
};
