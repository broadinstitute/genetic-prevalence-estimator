import {
  FormControl,
  FormLabel,
  HStack,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";

export type GeneticPrevalenceModel = "simplified" | "bayesian";

interface GeneticPrevalenceModelInputProps {
  value: GeneticPrevalenceModel;
  onChange: (value: GeneticPrevalenceModel) => void;
}

export const GeneticPrevalenceModelInput = (
  props: GeneticPrevalenceModelInputProps
) => {
  const { value, onChange } = props;
  return (
    <FormControl id="genetic-prevalence-model" as="fieldset">
      <FormLabel as="legend">Genetic prevalence model</FormLabel>
      <RadioGroup
        value={value}
        onChange={(value) => {
          onChange(value as GeneticPrevalenceModel);
        }}
      >
        <HStack spacing="24px">
          <Radio value="simplified">
            Simplified (q<sup>2</sup>)
          </Radio>

          <Radio value="bayesian">Bayesian estimate</Radio>
        </HStack>
      </RadioGroup>
    </FormControl>
  );
};
