import {
  Box,
  Heading,
  Text,
  Stack,
  List,
  ListItem,
  Flex,
  Tooltip,
} from "@chakra-ui/react";
import { useState } from "react";

import HelpTextHover from "../HelpTextHover";
import {
  DisplayFormat,
  renderFrequency,
  DisplayFormatInputIncidence,
} from "../VariantListPage/VariantListCalculations/calculationsDisplayFormats";

type DominantListChartsProps = {
  calculations: {
    missense_de_novo_incidence: number;
    lof_de_novo_incidence: number;
    total_de_novo_incidence: number;
    inputs: {
      oe_mis: number;
      mu_mis: number;
      oe_lof: number;
      mu_lof: number;
      oe_mis_prior: number;
      oe_lof_prior: number;
    };
  };
  gene_symbol: string;
};

const StyledBox = ({
  children,
  borderTopColor = "#CBD5E0",
}: {
  children: React.ReactNode;
  borderTopColor?: string;
}) => (
  <Box
    border="1px solid #CBD5E0"
    borderTop="5px solid"
    borderTopColor={borderTopColor}
    borderRadius="2xl"
    p={6}
    backgroundColor="white"
    boxShadow="md"
    w="full"
  >
    {children}
  </Box>
);

const StatBox = ({ value }: { value: React.ReactNode }) => (
  <Box
    border="1px solid black"
    px={6}
    py={3}
    minWidth="110px"
    textAlign="center"
    fontSize="md"
    fontWeight="semibold"
    borderRadius="md"
    bg="gray.50"
    height="50px"
  >
    {value}
  </Box>
);

const DominantListCharts = (props: DominantListChartsProps) => {
  const { calculations, gene_symbol } = props;
  const {
    missense_de_novo_incidence,
    lof_de_novo_incidence,
    total_de_novo_incidence,
    inputs: { oe_mis, mu_mis, oe_lof, mu_lof, oe_mis_prior, oe_lof_prior },
  } = calculations;

  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>(
    "fraction_of_100000"
  );

  return (
    <Stack spacing={6} mb={10}>
      <StyledBox>
        <Flex alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Heading size="md" mb={1}>
              Total de novo incidence for <strong>{gene_symbol}</strong>
            </Heading>

            <Flex alignItems="center" mb={2}>
              <Tooltip
                hasArrow
                label="([(oe_mis_prior − oe_mis) × mu_mis]+ [(oe_lof_prior − oe_lof) × mu_lof])× 2"
                placement="auto-end"
              >
                <Text fontStyle="italic" fontWeight="bold">
                  <Box as="span" color="#3B5BA5" fontWeight="bold">
                    Missense de novo incidence
                  </Box>
                  {" + "}
                  <Box as="span" color="#e45c3c" fontWeight="bold">
                    Loss of Function de novo incidence
                  </Box>
                </Text>
              </Tooltip>
            </Flex>

            <List spacing={1} fontSize="sm">
              <ListItem>
                • {gene_symbol} Missense de novo incidence:{" "}
                {renderFrequency(missense_de_novo_incidence, displayFormat)}
              </ListItem>
              <ListItem>
                • {gene_symbol} Loss of Function de novo incidence:{" "}
                {renderFrequency(lof_de_novo_incidence, displayFormat)}
              </ListItem>
            </List>

            <DisplayFormatInputIncidence
              value={displayFormat}
              onChange={(val) => setDisplayFormat(val)}
            />
          </Box>
          <StatBox
            value={renderFrequency(total_de_novo_incidence, displayFormat)}
          />
        </Flex>
      </StyledBox>

      <StyledBox borderTopColor="#3B5BA5">
        <Flex justifyContent="space-between">
          <Box>
            <Heading as="h3" size="sm" mb={2}>
              Missense de novo incidence
            </Heading>
            <Text fontStyle="italic" mb={3}>
              ((oe_mis_prior − oe_mis) × mu_mis) × 2
            </Text>
            <List spacing={1} fontSize="sm">
              <ListItem>
                • oe missense prior: {oe_mis_prior}
                <Box as="span" ml={2}>
                  <HelpTextHover
                    helpText={
                      <Text>
                        Average missense obeserved / expected (oe) for all
                        non-disease associated and non-olfactory genes in gnomAD
                      </Text>
                    }
                  />
                </Box>
              </ListItem>
              <ListItem>
                • {gene_symbol} oe missense: {oe_mis}
                <Box as="span" ml={2}>
                  <HelpTextHover
                    helpText={
                      <Text>
                        Represents the observed / expected (oe) number of
                        missense variants in a gene
                      </Text>
                    }
                  />
                </Box>
              </ListItem>
              <ListItem>
                • {gene_symbol}{" "}
                <Text as="span" fontStyle="italic">
                  mu
                </Text>{" "}
                missense: {mu_mis}
                <Box as="span" ml={2}>
                  <HelpTextHover
                    helpText={
                      <Text>
                        The expected number of new missense mutations in a
                        generation in a gene
                      </Text>
                    }
                  />
                </Box>
              </ListItem>
            </List>
          </Box>
          <StatBox
            value={renderFrequency(missense_de_novo_incidence, displayFormat)}
          />
        </Flex>
      </StyledBox>

      <StyledBox borderTopColor="#e45c3c">
        <Flex justifyContent="space-between">
          <Box>
            <Heading as="h3" size="sm" mb={2}>
              Loss of Function de novo incidence
            </Heading>
            <Text fontStyle="italic" mb={3}>
              ((oe_lof_prior − oe_lof) × mu_lof) × 2
            </Text>
            <List spacing={1} fontSize="sm">
              <ListItem>
                • oe LoF prior: {oe_lof_prior}
                <Box as="span" ml={2}>
                  <HelpTextHover
                    helpText={
                      <Text>
                        Average loss of function (LoF) observed / expected (oe)
                        for all non-disease associated and non-olfactory genes
                        in gnomAD
                      </Text>
                    }
                  />
                </Box>
              </ListItem>
              <ListItem>
                • {gene_symbol} oe LoF: {oe_lof}
                <Box as="span" ml={2}>
                  <HelpTextHover
                    helpText={
                      <Text>
                        Represents the observed / expected (oe) number of loss
                        of function variants in a gene
                      </Text>
                    }
                  />
                </Box>
              </ListItem>
              <ListItem>
                • {gene_symbol}{" "}
                <Text as="span" fontStyle="italic">
                  mu
                </Text>{" "}
                LoF: {mu_lof}
                <Box as="span" ml={2}>
                  <HelpTextHover
                    helpText={
                      <Text>
                        The expected number of new loss of function mutations in
                        a generation in a gene
                      </Text>
                    }
                  />
                </Box>
              </ListItem>
            </List>
          </Box>
          <StatBox
            value={renderFrequency(lof_de_novo_incidence, displayFormat)}
          />
        </Flex>
      </StyledBox>
    </Stack>
  );
};

export default DominantListCharts;
