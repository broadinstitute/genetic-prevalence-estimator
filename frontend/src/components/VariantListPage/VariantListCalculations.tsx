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
import {
  CustomVariantList,
  RecommendedVariantList,
  Variant,
  VariantList,
  VariantListType,
} from "../../types";

import { getVariantSources } from "./variantSources";

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

interface CustomVariantListCalculationsTableProps {
  displayFormat: CalculationsDisplayFormat;
  variants: Variant[];
  variantList: CustomVariantList;
}

const CustomVariantListCalculationsTable = (
  props: CustomVariantListCalculationsTableProps
) => {
  const { displayFormat, variants, variantList } = props;

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
          <Td isNumeric>
            {renderFrequency(carrierFrequency[0], displayFormat)}
          </Td>
          <Td isNumeric>{renderFrequency(prevalence[0], displayFormat)}</Td>
        </Tr>
        {variantList.metadata.populations!.map((popId, popIndex) => {
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

interface RecommendedVariantListCalculationsTableProps {
  displayFormat: CalculationsDisplayFormat;
  variants: Variant[];
  variantList: RecommendedVariantList;
}

const RecommendedVariantListCalculationsTable = (
  props: RecommendedVariantListCalculationsTableProps
) => {
  const { displayFormat, variants, variantList } = props;

  const { carrierFrequency, prevalence } = useMemo(
    () => calculateCarrierFrequencyAndPrevalence(variants),
    [variants]
  );

  const {
    carrierFrequency: clinvarOnlyCarrierFrequency,
    prevalence: clinvarOnlyPrevalence,
  } = useMemo(
    () =>
      calculateCarrierFrequencyAndPrevalence(
        variants.filter((variant) =>
          getVariantSources(variant, variantList).includes("ClinVar")
        )
      ),
    [variantList, variants]
  );

  const {
    carrierFrequency: gnomadOnlyCarrierFrequency,
    prevalence: gnomadOnlyPrevalence,
  } = useMemo(
    () =>
      calculateCarrierFrequencyAndPrevalence(
        variants.filter((variant) =>
          getVariantSources(variant, variantList).includes("gnomAD")
        )
      ),
    [variantList, variants]
  );

  return (
    <Table size="sm">
      <colgroup>
        <col />
        <col span={2} />
        <col span={2} />
        <col span={2} />
      </colgroup>
      <Thead>
        <Tr>
          <Th scope="col" rowSpan={2}>
            Population
          </Th>
          <Th scope="col" isNumeric>
            Carrier frequency
          </Th>
          <Th scope="col" isNumeric>
            Prevalence
          </Th>
          <Th scope="col" isNumeric>
            Carrier frequency
            <br />
            (ClinVar only)
          </Th>
          <Th scope="col" isNumeric>
            Prevalence
            <br />
            (ClinVar only)
          </Th>
          <Th scope="col" isNumeric>
            Carrier frequency
            <br />
            (gnomAD only)
          </Th>
          <Th scope="col" isNumeric>
            Prevalence
            <br />
            (gnomAD only)
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
          <Td isNumeric>
            {renderFrequency(clinvarOnlyCarrierFrequency[0], displayFormat)}
          </Td>
          <Td isNumeric>
            {renderFrequency(clinvarOnlyPrevalence[0], displayFormat)}
          </Td>
          <Td isNumeric>
            {renderFrequency(gnomadOnlyCarrierFrequency[0], displayFormat)}
          </Td>
          <Td isNumeric>
            {renderFrequency(gnomadOnlyPrevalence[0], displayFormat)}
          </Td>
        </Tr>
        {variantList.metadata.populations!.map((popId, popIndex) => {
          return (
            <Tr key={popId}>
              <Th scope="row">{GNOMAD_POPULATION_NAMES[popId]}</Th>
              <Td isNumeric>
                {renderFrequency(carrierFrequency[popIndex + 1], displayFormat)}
              </Td>
              <Td isNumeric>
                {renderFrequency(prevalence[popIndex + 1], displayFormat)}
              </Td>
              <Td isNumeric>
                {renderFrequency(
                  clinvarOnlyCarrierFrequency[popIndex + 1],
                  displayFormat
                )}
              </Td>
              <Td isNumeric>
                {renderFrequency(
                  clinvarOnlyPrevalence[popIndex + 1],
                  displayFormat
                )}
              </Td>
              <Td isNumeric>
                {renderFrequency(
                  gnomadOnlyCarrierFrequency[popIndex + 1],
                  displayFormat
                )}
              </Td>
              <Td isNumeric>
                {renderFrequency(
                  gnomadOnlyPrevalence[popIndex + 1],
                  displayFormat
                )}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

interface VariantListCalculationsProps {
  variantList: VariantList;
  variants: Variant[];
}

const VariantListCalculations = (props: VariantListCalculationsProps) => {
  const { variantList, variants } = props;

  const [displayFormat, setDisplayFormat] = useState<CalculationsDisplayFormat>(
    "fraction"
  );

  return (
    <Box>
      {variantList.type === VariantListType.CUSTOM && (
        <CustomVariantListCalculationsTable
          displayFormat={displayFormat}
          variants={variants}
          variantList={variantList}
        />
      )}

      {variantList.type === VariantListType.RECOMMENDED && (
        <RecommendedVariantListCalculationsTable
          displayFormat={displayFormat}
          variants={variants}
          variantList={variantList}
        />
      )}

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
