import {
  Box,
  FormControl,
  FormLabel,
  HStack,
  Radio,
  RadioGroup,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../constants/populations";
import { GnomadPopulationId, Variant } from "../../types";

const calculateCarrierFrequencyAndPrevalence = (variants: Variant[]) => {
  const alleleFrequencies = variants.map((variant) => {
    return variant.AC!.map((ac, i) => {
      const an = variant.AN![i];
      return an === 0 ? 0 : ac / an;
    });
  });

  const carrierFrequency = alleleFrequencies
    .map((af) => af.map((q) => 2 * (1 - q) * q))
    .reduce((acc, values) => acc.map((n, i) => n + values[i]));

  const prevalence = alleleFrequencies
    .map((af) => af.map((q) => q ** 2))
    .reduce((acc, values) => acc.map((n, i) => n + values[i]));

  return { carrierFrequency, prevalence };
};

const renderFrequencyScientific = (f: number) => {
  const truncated = Number(f.toPrecision(3));
  if (truncated === 0 || truncated === 1) {
    return f.toFixed(0);
  } else {
    return truncated.toExponential(2);
  }
};

const renderFrequencyFraction = (f: number) => {
  return f === 0 ? "–" : `1 / ${Math.round(1 / f).toLocaleString()}`;
};

type CalculationsDisplayFormat = "scientific" | "fraction";

const renderFrequency = (f: number, format: CalculationsDisplayFormat) => {
  if (format === "scientific") {
    return renderFrequencyScientific(f);
  }
  if (format === "fraction") {
    return renderFrequencyFraction(f);
  }
};

interface VariantListCalculationsProps {
  populations: GnomadPopulationId[];
  variants: Variant[];
}

const VariantListCalculations = (props: VariantListCalculationsProps) => {
  const { populations, variants } = props;

  const { carrierFrequency, prevalence } = useMemo(
    () => calculateCarrierFrequencyAndPrevalence(variants),
    [variants]
  );

  const [displayFormat, setDisplayFormat] = useState<CalculationsDisplayFormat>(
    "fraction"
  );

  return (
    <Box>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th scope="col">Population</Th>
            <Th scope="col" isNumeric>
              Carrier frequency
            </Th>
            <Th scope="col" isNumeric>
              Prevalence
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Th scope="row">Global</Th>
            <Td isNumeric>
              {renderFrequency(carrierFrequency[0], displayFormat)}
            </Td>
            <Td isNumeric>{renderFrequency(prevalence[0], displayFormat)}</Td>
          </Tr>
          {populations.map((popId, popIndex) => {
            return (
              <Tr key={popId}>
                <Th scope="row">{GNOMAD_POPULATION_NAMES[popId]}</Th>
                <Td isNumeric>
                  {renderFrequency(
                    carrierFrequency[popIndex + 1],
                    displayFormat
                  )}
                </Td>
                <Td isNumeric>
                  {renderFrequency(prevalence[popIndex + 1], displayFormat)}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>

      <FormControl id="calculations-format" as="fieldset" mt={2}>
        <FormLabel as="legend">Display format</FormLabel>
        <RadioGroup
          value={displayFormat}
          onChange={(value) => {
            setDisplayFormat(value as CalculationsDisplayFormat);
          }}
        >
          <HStack spacing="24px">
            <Radio value="fraction">Fraction</Radio>
            <Radio value="scientific">Scientific</Radio>
          </HStack>
        </RadioGroup>
      </FormControl>
    </Box>
  );
};

export default VariantListCalculations;
