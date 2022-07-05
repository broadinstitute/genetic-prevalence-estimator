import {
  Box,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Stack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";

import theme from "../../../theme";
import { Variant, VariantList } from "../../../types";

import { getVariantSources } from "../variantSources";

import BarGraph from "./BarGraph";
import { calculateCarrierFrequencyAndPrevalence } from "./calculations";
import {
  DisplayFormat,
  DisplayFormatInput,
} from "./calculationsDisplayFormats";
import {
  CarrierFrequencyModel,
  CarrierFrequencyModelInput,
} from "./carrierFrequencyModels";
import CalculationsTable from "./CalculationsTable";

interface VariantListCalculationsProps {
  variantList: VariantList;
  variants: Variant[];
}

const VariantListCalculations = (props: VariantListCalculationsProps) => {
  const { variantList, variants } = props;

  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>("fraction");
  const [
    carrierFrequencyModel,
    setCarrierFrequencyModel,
  ] = useState<CarrierFrequencyModel>("full");

  const hasOptionToShowContributionsBySource =
    (variantList.metadata.include_clinvar_clinical_significance || []).length >
    0;
  const [showContributionsBySource, setShowContributionsBySource] = useState(
    false
  );

  const {
    carrierFrequency,
    carrierFrequencySimplified,
    prevalence,
  } = useMemo(
    () => calculateCarrierFrequencyAndPrevalence(variants, variantList),
    [variants, variantList]
  );

  const {
    carrierFrequency: clinvarOnlyCarrierFrequency,
    carrierFrequencySimplified: clinvarOnlyCarrierFrequencySimplified,
  } = useMemo(
    () =>
      hasOptionToShowContributionsBySource
        ? calculateCarrierFrequencyAndPrevalence(
            variants.filter((variant) =>
              getVariantSources(variant, variantList).includes("ClinVar")
            ),
            variantList
          )
        : {
            carrierFrequency: null,
            carrierFrequencySimplified: null,
          },
    [hasOptionToShowContributionsBySource, variantList, variants]
  );

  const {
    carrierFrequency: plofOnlyCarrierFrequency,
    carrierFrequencySimplified: plofOnlyCarrierFrequencySimplified,
  } = useMemo(
    () =>
      hasOptionToShowContributionsBySource
        ? calculateCarrierFrequencyAndPrevalence(
            variants.filter(
              (variant) =>
                !getVariantSources(variant, variantList).includes("ClinVar")
            ),
            variantList
          )
        : {
            carrierFrequency: null,
            carrierFrequencySimplified: null,
          },
    [hasOptionToShowContributionsBySource, variantList, variants]
  );

  let stackHorizontally = useBreakpointValue({ base: false, lg: true });
  if (stackHorizontally === undefined) {
    stackHorizontally = true;
  }

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
                      ? carrierFrequencySimplified
                      : carrierFrequency,
                },
                ...(showContributionsBySource
                  ? [
                      {
                        label: "Carrier frequency (ClinVar)",

                        data:
                          carrierFrequencyModel === "simplified"
                            ? clinvarOnlyCarrierFrequencySimplified!
                            : clinvarOnlyCarrierFrequency!,
                      },
                      {
                        label: "Carrier frequency (pLoF only)",

                        data:
                          carrierFrequencyModel === "simplified"
                            ? plofOnlyCarrierFrequencySimplified!
                            : plofOnlyCarrierFrequency!,
                      },
                    ]
                  : []),
              ]}
              populations={variantList.metadata.populations!}
              displayFormat={displayFormat}
            />
          </Box>
          <Box width={stackHorizontally ? "calc(40% - 16px)" : "100%"}>
            <BarGraph
              label="Carrier frequency"
              populations={variantList.metadata.populations!}
              series={
                showContributionsBySource
                  ? [
                      {
                        label: "Carrier frequency (ClinVar)",
                        color: theme.colors.purple["600"],
                        data:
                          carrierFrequencyModel === "simplified"
                            ? clinvarOnlyCarrierFrequencySimplified!
                            : clinvarOnlyCarrierFrequency!,
                      },
                      {
                        label: "Carrier frequency (pLoF only)",
                        color: theme.colors.red["600"],
                        data:
                          carrierFrequencyModel === "simplified"
                            ? plofOnlyCarrierFrequencySimplified!
                            : plofOnlyCarrierFrequency!,
                      },
                    ]
                  : [
                      {
                        label: "Carrier frequency",
                        data:
                          carrierFrequencyModel === "simplified"
                            ? carrierFrequencySimplified
                            : carrierFrequency,
                      },
                    ]
              }
              displayFormat={displayFormat}
            />
          </Box>
        </Stack>

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
      </Box>

      <Box spacing={4} mb={8}>
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
                  data: prevalence,
                },
              ]}
              populations={variantList.metadata.populations!}
              displayFormat={displayFormat}
            />
          </Box>
          <Box width={stackHorizontally ? "calc(40% - 16px)" : "100%"}>
            <BarGraph
              label="Prevalence"
              populations={variantList.metadata.populations!}
              series={[
                {
                  label: "Prevalence",
                  data: prevalence,
                },
              ]}
              displayFormat={displayFormat}
            />
          </Box>
        </Stack>

        <Box>
          <DisplayFormatInput
            value={displayFormat}
            onChange={setDisplayFormat}
          />
        </Box>
      </Box>
    </>
  );
};

export default VariantListCalculations;
