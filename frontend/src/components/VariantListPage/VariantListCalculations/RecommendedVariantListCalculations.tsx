import {
  Box,
  Checkbox,
  Flex,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../../constants/populations";
import {
  GnomadPopulationId,
  RecommendedVariantList,
  Variant,
} from "../../../types";

import { getVariantSources } from "../variantSources";

import BarGraph from "./BarGraph";
import { calculateCarrierFrequencyAndPrevalence } from "./calculations";
import {
  DisplayFormat,
  renderFrequency,
  DisplayFormatInput,
} from "./calculationsDisplayFormats";
import {
  CarrierFrequencyModel,
  CarrierFrequencyModelInput,
} from "./carrierFrequencyModels";

interface RecommendedVariantListCalculationsTableProps {
  carrierFrequency: number[];
  prevalence: number[];
  clinvarOnlyCarrierFrequency: number[];
  clinvarOnlyPrevalence: number[];
  gnomadOnlyCarrierFrequency: number[];
  gnomadOnlyPrevalence: number[];
  populations: GnomadPopulationId[];
  displayFormat: DisplayFormat;
  showContributionsBySource: boolean;
}

const RecommendedVariantListCalculationsTable = (
  props: RecommendedVariantListCalculationsTableProps
) => {
  const {
    carrierFrequency,
    prevalence,
    clinvarOnlyCarrierFrequency,
    clinvarOnlyPrevalence,
    gnomadOnlyCarrierFrequency,
    gnomadOnlyPrevalence,
    populations,
    displayFormat,
    showContributionsBySource,
  } = props;

  return (
    <Table size="sm">
      <colgroup>
        <col />
        <col span={2} />
        {showContributionsBySource && (
          <>
            <col span={2} />
            <col span={2} />
          </>
        )}
      </colgroup>
      <Thead>
        <Tr>
          <Th scope="col">Population</Th>
          <Th scope="col" isNumeric>
            Carrier frequency{showContributionsBySource && " (Overall)"}
          </Th>
          <Th scope="col" isNumeric>
            Prevalence{showContributionsBySource && " (Overall)"}
          </Th>
          {showContributionsBySource && (
            <>
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
            </>
          )}
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Td as="th" scope="row" fontWeight="normal">
            Global
          </Td>
          <Td isNumeric>
            {renderFrequency(carrierFrequency[0], displayFormat)}
          </Td>
          <Td isNumeric>{renderFrequency(prevalence[0], displayFormat)}</Td>
          {showContributionsBySource && (
            <>
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
            </>
          )}
        </Tr>
        {populations.map((popId, popIndex) => {
          return (
            <Tr key={popId}>
              <Td as="th" scope="row" fontWeight="normal">
                {GNOMAD_POPULATION_NAMES[popId]}
              </Td>
              <Td isNumeric>
                {renderFrequency(carrierFrequency[popIndex + 1], displayFormat)}
              </Td>
              <Td isNumeric>
                {renderFrequency(prevalence[popIndex + 1], displayFormat)}
              </Td>
              {showContributionsBySource && (
                <>
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
                </>
              )}
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

interface RecommendedVariantListCalculationsProps {
  variants: Variant[];
  variantList: RecommendedVariantList;
}

const RecommendedVariantListCalculations = (
  props: RecommendedVariantListCalculationsProps
) => {
  const { variants, variantList } = props;

  const {
    carrierFrequency,
    carrierFrequencySimplified,
    prevalence,
  } = useMemo(() => calculateCarrierFrequencyAndPrevalence(variants), [
    variants,
  ]);

  const {
    carrierFrequency: clinvarOnlyCarrierFrequency,
    carrierFrequencySimplified: clinvarOnlyCarrierFrequencySimplified,
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
    carrierFrequencySimplified: gnomadOnlyCarrierFrequencySimplified,
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

  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>("fraction");
  const [
    carrierFrequencyModel,
    setCarrierFrequencyModel,
  ] = useState<CarrierFrequencyModel>("full");
  const [showContributionsBySource, setShowContributionsBySource] = useState(
    false
  );

  return (
    <Box mb={4}>
      <Box mb={2} style={{ width: "100%", overflowX: "auto" }}>
        <RecommendedVariantListCalculationsTable
          carrierFrequency={
            carrierFrequencyModel === "simplified"
              ? carrierFrequencySimplified
              : carrierFrequency
          }
          prevalence={prevalence}
          clinvarOnlyCarrierFrequency={
            carrierFrequencyModel === "simplified"
              ? clinvarOnlyCarrierFrequencySimplified
              : clinvarOnlyCarrierFrequency
          }
          clinvarOnlyPrevalence={clinvarOnlyPrevalence}
          gnomadOnlyCarrierFrequency={
            carrierFrequencyModel === "simplified"
              ? gnomadOnlyCarrierFrequencySimplified
              : gnomadOnlyCarrierFrequency
          }
          gnomadOnlyPrevalence={gnomadOnlyPrevalence}
          populations={variantList.metadata.populations!}
          displayFormat={displayFormat}
          showContributionsBySource={showContributionsBySource}
        />
      </Box>

      <Flex justify="space-around" wrap="wrap" mb={2}>
        <BarGraph
          label="Carrier frequency"
          populations={variantList.metadata.populations!}
          series={[
            {
              label: "Carrier frequency",
              data:
                carrierFrequencyModel === "simplified"
                  ? carrierFrequencySimplified
                  : carrierFrequency,
            },
            ...(showContributionsBySource
              ? [
                  {
                    label: "Carrier frequency (ClinVar only)",
                    data:
                      carrierFrequencyModel === "simplified"
                        ? clinvarOnlyCarrierFrequencySimplified
                        : clinvarOnlyCarrierFrequency,
                  },
                  {
                    label: "Carrier frequency (gnomAD only)",
                    data:
                      carrierFrequencyModel === "simplified"
                        ? gnomadOnlyCarrierFrequencySimplified
                        : gnomadOnlyCarrierFrequency,
                  },
                ]
              : []),
          ]}
          displayFormat={displayFormat}
        />

        <BarGraph
          label="Prevalence"
          populations={variantList.metadata.populations!}
          series={[
            {
              label: "Prevalence",
              data: prevalence,
            },
            ...(showContributionsBySource
              ? [
                  {
                    label: "Prevalence (ClinVar only)",
                    data: clinvarOnlyPrevalence,
                  },
                  {
                    label: "Prevalence (gnomAD only)",
                    data: gnomadOnlyPrevalence,
                  },
                ]
              : []),
          ]}
          displayFormat={displayFormat}
        />
      </Flex>

      <Flex align="flex-end" justify="space-between" wrap="wrap">
        <HStack spacing={16}>
          <div>
            <DisplayFormatInput
              value={displayFormat}
              onChange={setDisplayFormat}
            />
          </div>

          <div>
            <CarrierFrequencyModelInput
              value={carrierFrequencyModel}
              onChange={setCarrierFrequencyModel}
            />
          </div>
        </HStack>

        <Checkbox
          isChecked={showContributionsBySource}
          onChange={(e) => {
            setShowContributionsBySource(e.target.checked);
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>
            Compare contributions of ClinVar and gnomAD variants
          </span>
        </Checkbox>
      </Flex>
    </Box>
  );
};

export default RecommendedVariantListCalculations;
