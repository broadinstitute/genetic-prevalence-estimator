import { Box, Table, Thead, Tbody, Tr, Th, Td } from "@chakra-ui/react";
import { useMemo, useState } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../../constants/populations";
import { CustomVariantList, GnomadPopulationId, Variant } from "../../../types";

import { calculateCarrierFrequencyAndPrevalence } from "./calculations";
import {
  DisplayFormat,
  renderFrequency,
  DisplayFormatInput,
} from "./calculationsDisplayFormats";

interface CustomVariantListCalculationsTableProps {
  carrierFrequency: number[];
  prevalence: number[];
  populations: GnomadPopulationId[];
  displayFormat: DisplayFormat;
}

const CustomVariantListCalculationsTable = (
  props: CustomVariantListCalculationsTableProps
) => {
  const { carrierFrequency, prevalence, populations, displayFormat } = props;

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
                {renderFrequency(carrierFrequency[popIndex + 1], displayFormat)}
              </Td>
              <Td isNumeric>
                {renderFrequency(prevalence[popIndex + 1], displayFormat)}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

interface CustomVariantListCalculationsProps {
  variants: Variant[];
  variantList: CustomVariantList;
}

const CustomVariantListCalculations = (
  props: CustomVariantListCalculationsProps
) => {
  const { variants, variantList } = props;

  const { carrierFrequency, prevalence } = useMemo(
    () => calculateCarrierFrequencyAndPrevalence(variants),
    [variants]
  );

  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>("fraction");

  return (
    <Box mb={4}>
      <Box mb={2}>
        <CustomVariantListCalculationsTable
          carrierFrequency={carrierFrequency}
          prevalence={prevalence}
          populations={variantList.metadata.populations!}
          displayFormat={displayFormat}
        />
      </Box>

      <DisplayFormatInput value={displayFormat} onChange={setDisplayFormat} />
    </Box>
  );
};

export default CustomVariantListCalculations;
