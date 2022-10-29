import { Table, Thead, Tbody, Tr, Th, Td, Text } from "@chakra-ui/react";

import {
  GNOMAD_POPULATION_NAMES,
  isSubcontinentalPopulation,
} from "../../../constants/populations";
import { GnomadPopulationId } from "../../../types";

import { DisplayFormat, renderFrequency } from "./calculationsDisplayFormats";

interface CalculationsTableProps {
  columns: {
    label: string;
    data: Partial<Record<GnomadPopulationId, number>>;
  }[];
  populations: GnomadPopulationId[];
  displayFormat: DisplayFormat;
}

const CalculationsTable = (props: CalculationsTableProps) => {
  const { columns, populations, displayFormat } = props;

  return (
    <Table
      size="sm"
      sx={{
        "& th:first-child, & td:first-child": { paddingLeft: 0 },
        "& td:last-child, & th:last-child": { paddingRight: 0 },
      }}
    >
      <Thead>
        <Tr>
          <Th scope="col">Population</Th>
          {columns.map((column) => (
            <Th key={column.label} scope="col" isNumeric>
              {column.label}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {populations.map((populationId) => {
          return (
            <Tr key={populationId}>
              <Td as="th" scope="row" fontWeight="normal">
                <Text
                  as="span"
                  ml={isSubcontinentalPopulation(populationId) ? 4 : 0}
                >
                  {GNOMAD_POPULATION_NAMES[populationId]}
                </Text>
              </Td>
              {columns.map((column) => (
                <Td key={column.label} scope="col" isNumeric>
                  {column.data[populationId] === undefined
                    ? "–"
                    : renderFrequency(
                        column.data[populationId]!,
                        displayFormat
                      )}
                </Td>
              ))}
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

export default CalculationsTable;
