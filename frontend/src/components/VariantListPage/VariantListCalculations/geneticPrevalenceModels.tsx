import {
  Box,
  FormControl,
  FormLabel,
  HStack,
  Radio,
  RadioGroup,
  Text,
} from "@chakra-ui/react";
import HelpTextHover from "../../HelpTextHover";

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
      <Box display="flex">
        <FormLabel as="legend">Genetic prevalence model</FormLabel>
        <Box>
          <HelpTextHover
            helpText={
              <>
                <Text>
                  The <strong>Simplified</strong> model is based on the
                  Hardy-Weinberg equation. It square the cumulative allele
                  frequency of all variants in the list
                </Text>
                <Text mt={4}>
                  The <strong>Bayesian estimate</strong> accounts for linkage
                  equilibrium between variants. This can make a slight
                  difference in more common recessive diseases{" "}
                </Text>
              </>
            }
          />
        </Box>
      </Box>
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
