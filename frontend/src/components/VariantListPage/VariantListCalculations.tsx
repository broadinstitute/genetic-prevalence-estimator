import { Table, Thead, Tbody, Tr, Th, Td } from "@chakra-ui/react";
import { useMemo } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../constants/populations";
import { GnomadPopulationId, Variant } from "../../types";

interface VariantListCalculationsProps {
  populations: GnomadPopulationId[];
  variants: Variant[];
}

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

const renderFrequency = (f: number) => {
  const truncated = Number(f.toPrecision(3));
  if (truncated === 0 || truncated === 1) {
    return f.toFixed(0);
  } else {
    return truncated.toExponential(2);
  }
};

const VariantListCalculations = (props: VariantListCalculationsProps) => {
  const { populations, variants } = props;

  const { carrierFrequency, prevalence } = useMemo(
    () => calculateCarrierFrequencyAndPrevalence(variants),
    [variants]
  );

  return (
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
          <Td isNumeric>{renderFrequency(carrierFrequency[0])}</Td>
          <Td isNumeric>{renderFrequency(prevalence[0])}</Td>
        </Tr>
        {populations.map((popId, popIndex) => {
          return (
            <Tr key={popId}>
              <Th scope="row">{GNOMAD_POPULATION_NAMES[popId]}</Th>
              <Td isNumeric>
                {renderFrequency(carrierFrequency[popIndex + 1])}
              </Td>
              <Td isNumeric>{renderFrequency(prevalence[popIndex + 1])}</Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

export default VariantListCalculations;
