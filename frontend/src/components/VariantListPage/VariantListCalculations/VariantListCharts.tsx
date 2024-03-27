import {
  Box,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Stack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { sortBy } from "lodash";
import { useState } from "react";

import { isSubcontinentalPopulation } from "../../../constants/populations";
import theme from "../../../theme";
import { GnomadPopulationId } from "../../../types";

import BarGraph from "./BarGraph";
import {
  DisplayFormat,
  DisplayFormatInput,
} from "./calculationsDisplayFormats";
import {
  CarrierFrequencyModel,
  CarrierFrequencyModelInput,
} from "./carrierFrequencyModels";
import CalculationsTable from "./CalculationsTable";

interface VariantListChartsProps {
  genetic_ancestry_groups: GnomadPopulationId[];
  hasOptionToShowContributionsBySource: boolean;

  carrierFrequency: Partial<Record<GnomadPopulationId, number>>;
  carrierFrequencySimplified: Partial<Record<GnomadPopulationId, number>>;
  carrierFrequencyRawNumbers: Partial<
    Record<GnomadPopulationId, { total_ac: number; average_an: number }>
  >;
  prevalence: Partial<Record<GnomadPopulationId, number>>;
  clinvarOnlyCarrierFrequency: Partial<Record<GnomadPopulationId, number>>;
  clinvarOnlyCarrierFrequencySimplified: Partial<
    Record<GnomadPopulationId, number>
  >;
  clinvarOnlyCarrierFrequencyRawNumbers: Partial<
    Record<GnomadPopulationId, { total_ac: number; average_an: number }>
  >;
  plofOnlyCarrierFrequency: Partial<Record<GnomadPopulationId, number>>;
  plofOnlyCarrierFrequencySimplified: Partial<
    Record<GnomadPopulationId, number>
  >;
  plofOnlyCarrierFrequencyRawNumbers: Partial<
    Record<GnomadPopulationId, { total_ac: number; average_an: number }>
  >;
}

const VariantListCharts = (props: VariantListChartsProps) => {
  const {
    genetic_ancestry_groups,
    hasOptionToShowContributionsBySource,
    carrierFrequency,
    carrierFrequencySimplified,
    carrierFrequencyRawNumbers,
    prevalence,
    clinvarOnlyCarrierFrequency,
    clinvarOnlyCarrierFrequencySimplified,
    clinvarOnlyCarrierFrequencyRawNumbers,
    plofOnlyCarrierFrequency,
    plofOnlyCarrierFrequencySimplified,
    plofOnlyCarrierFrequencyRawNumbers,
  } = props;

  const allPopulations: GnomadPopulationId[] = [
    "global",
    ...genetic_ancestry_groups,
  ];

  const variantListHasSubcontinentalPopulations = genetic_ancestry_groups.some(
    isSubcontinentalPopulation
  );

  const [
    includeSubcontinentalPopulations,
    setIncludeSubcontinentalPopulations,
  ] = useState(variantListHasSubcontinentalPopulations);

  const displayedPopulations = includeSubcontinentalPopulations
    ? allPopulations
    : allPopulations.filter((popId) => !isSubcontinentalPopulation(popId));

  const sortedPopulations = sortBy(displayedPopulations, (popId) => [
    popId === "global" ? 0 : 1,
    isSubcontinentalPopulation(popId) ? popId.split("/")[0] : popId,
    popId,
  ]);

  const [
    displayFormatCarrierFrequency,
    setDisplayFormatCarrierFrequency,
  ] = useState<DisplayFormat>("fraction");
  const [
    displayFormatGeneticPrevalence,
    setDisplayFormatGeneticPrevalence,
  ] = useState<DisplayFormat>("fraction");

  const [
    carrierFrequencyModel,
    setCarrierFrequencyModel,
  ] = useState<CarrierFrequencyModel>("full");

  const [showContributionsBySource, setShowContributionsBySource] = useState(
    false
  );

  let stackHorizontally = useBreakpointValue({ base: false, lg: true });
  if (stackHorizontally === undefined) {
    stackHorizontally = true;
  }

  // TODO: move toSeries into the wrapper
  const toSeries = (populationData: { [popId: string]: number }) =>
    allPopulations.map((popId) => populationData[popId]);

  return (
    <>
      <Box mb={8}>
        <Heading as="h2" size="md" mb={2}>
          Carrier frequency
        </Heading>

        <Stack
          direction={stackHorizontally ? "row" : "column"}
          spacing={stackHorizontally ? 8 : 4}
          mb={4}
        >
          <Box width={stackHorizontally ? "calc(60% - 16px)" : "100%"}>
            <CalculationsTable
              columns={[
                {
                  label: "Carrier frequency",
                  data:
                    carrierFrequencyModel === "simplified"
                      ? carrierFrequencySimplified!
                      : carrierFrequencyModel === "raw_numbers"
                      ? carrierFrequencyRawNumbers
                      : carrierFrequency!,
                },
                ...(showContributionsBySource
                  ? [
                      {
                        label: "Carrier frequency (ClinVar)",

                        data:
                          carrierFrequencyModel === "simplified"
                            ? clinvarOnlyCarrierFrequencySimplified!
                            : carrierFrequencyModel === "raw_numbers"
                            ? clinvarOnlyCarrierFrequencyRawNumbers
                            : clinvarOnlyCarrierFrequency!,
                      },
                      {
                        label: "Carrier frequency (pLoF only)",

                        data:
                          carrierFrequencyModel === "simplified"
                            ? plofOnlyCarrierFrequencySimplified!
                            : carrierFrequencyModel === "raw_numbers"
                            ? plofOnlyCarrierFrequencyRawNumbers
                            : plofOnlyCarrierFrequency!,
                      },
                    ]
                  : []),
              ]}
              populations={sortedPopulations}
              displayFormat={displayFormatCarrierFrequency}
            />
          </Box>
          <Box width={stackHorizontally ? "calc(40% - 16px)" : "100%"}>
            <BarGraph
              label="Carrier frequency"
              populations={sortedPopulations}
              series={
                showContributionsBySource
                  ? [
                      {
                        label: "Carrier frequency (ClinVar)",
                        color: theme.colors.purple["600"],
                        data: toSeries(
                          carrierFrequencyModel === "simplified"
                            ? clinvarOnlyCarrierFrequencySimplified!
                            : clinvarOnlyCarrierFrequency!
                        ),
                      },
                      {
                        label: "Carrier frequency (pLoF only)",
                        color: theme.colors.red["600"],
                        data: toSeries(
                          carrierFrequencyModel === "simplified"
                            ? plofOnlyCarrierFrequencySimplified!
                            : plofOnlyCarrierFrequency!
                        ),
                      },
                    ]
                  : [
                      {
                        label: "Carrier frequency",
                        data: toSeries(
                          carrierFrequencyModel === "simplified"
                            ? carrierFrequencySimplified!
                            : carrierFrequency!
                        ),
                      },
                    ]
              }
              // raw numbers displays as total AC / average an for the calculations table
              //   but this has no meaning when plotting, revert to plotting based
              //   on fraction in this case
              displayFormat={
                displayFormatCarrierFrequency !== "raw_numbers"
                  ? displayFormatCarrierFrequency
                  : "fraction"
              }
            />
          </Box>
        </Stack>

        <Flex align="flex-end" justify="space-between" wrap="wrap" mb={4}>
          <HStack spacing={16}>
            <div>
              <CarrierFrequencyModelInput
                value={carrierFrequencyModel}
                onChange={(e) => {
                  setDisplayFormatCarrierFrequency(
                    e === "raw_numbers" ? "raw_numbers" : "fraction"
                  );
                  setCarrierFrequencyModel(e);
                }}
              />
            </div>
            {carrierFrequencyModel !== "raw_numbers" && (
              <div>
                <DisplayFormatInput
                  value={displayFormatCarrierFrequency}
                  onChange={setDisplayFormatCarrierFrequency}
                />
              </div>
            )}
          </HStack>

          {hasOptionToShowContributionsBySource && (
            <Checkbox
              isChecked={showContributionsBySource}
              onChange={(e) => {
                setShowContributionsBySource(e.target.checked);
              }}
            >
              <span style={{ whiteSpace: "nowrap" }}>
                Compare contributions by source
              </span>
            </Checkbox>
          )}
        </Flex>

        <Box>
          <Checkbox
            disabled={!variantListHasSubcontinentalPopulations}
            isChecked={includeSubcontinentalPopulations}
            onChange={(e) => {
              setIncludeSubcontinentalPopulations(e.target.checked);
            }}
          >
            <span style={{ whiteSpace: "nowrap" }}>
              Include subcontinental populations
            </span>
          </Checkbox>
        </Box>
      </Box>

      <Box mb={8}>
        <Heading as="h2" size="md" mb={2}>
          Prevalence
        </Heading>

        <Stack
          direction={stackHorizontally ? "row" : "column"}
          spacing={stackHorizontally ? 8 : 4}
          mb={4}
        >
          <Box width={stackHorizontally ? "calc(60% - 16px)" : "100%"}>
            <CalculationsTable
              columns={[
                {
                  label: "Prevalence",
                  data: prevalence!,
                },
              ]}
              populations={sortedPopulations}
              displayFormat={displayFormatGeneticPrevalence}
            />
          </Box>
          <Box width={stackHorizontally ? "calc(40% - 16px)" : "100%"}>
            <BarGraph
              label="Prevalence"
              populations={sortedPopulations}
              series={[
                {
                  label: "Prevalence",
                  data: toSeries(prevalence!),
                },
              ]}
              displayFormat={displayFormatGeneticPrevalence}
            />
          </Box>
        </Stack>

        <Box mb={4}>
          <DisplayFormatInput
            value={displayFormatGeneticPrevalence}
            onChange={setDisplayFormatGeneticPrevalence}
            includeFractionOf100000
          />
        </Box>

        <Box>
          <Checkbox
            disabled={!variantListHasSubcontinentalPopulations}
            isChecked={includeSubcontinentalPopulations}
            onChange={(e) => {
              setIncludeSubcontinentalPopulations(e.target.checked);
            }}
          >
            <span style={{ whiteSpace: "nowrap" }}>
              Include subcontinental populations
            </span>
          </Checkbox>
        </Box>
      </Box>
    </>
  );
};

export default VariantListCharts;
