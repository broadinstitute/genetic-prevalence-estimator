import {
  FormControl,
  FormLabel,
  HStack,
  Radio,
  RadioGroup,
  Tooltip,
} from "@chakra-ui/react";

export type CarrierFrequencyModel = "full" | "simplified" | "raw_numbers";

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
          <Radio value="raw_numbers">
            <Tooltip
              label={
                "This display format gives you the sum total of the allele counts for all variants included over the average allele number (AN) for all variants included. AN can vary for each variant due to differences in coverage across regions of a gene and/or limitations of exomes"
              }
            >
              Raw Numbers
            </Tooltip>
          </Radio>
        </HStack>
      </RadioGroup>
    </FormControl>
  );
};
