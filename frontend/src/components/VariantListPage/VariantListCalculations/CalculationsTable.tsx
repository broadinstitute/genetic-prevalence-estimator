import { Table, Thead, Tbody, Tr, Th, Td } from "@chakra-ui/react";

import { GNOMAD_POPULATION_NAMES } from "../../../constants/populations";
import { GnomadPopulationId } from "../../../types";

import { DisplayFormat, renderFrequency } from "./calculationsDisplayFormats";

interface CalculationsTableProps {
  columns: { label: string; data: number[] }[];
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
        <Tr>
          <Td as="th" scope="row" fontWeight="normal">
            Global
          </Td>
          {columns.map((column) => (
            <Td key={column.label} scope="col" isNumeric>
              {renderFrequency(column.data[0], displayFormat)}
            </Td>
          ))}
        </Tr>
        {populations.map((population, populationIndex) => {
          return (
            <Tr key={population}>
              <Td as="th" scope="row" fontWeight="normal">
                {GNOMAD_POPULATION_NAMES[population]}
              </Td>
              {columns.map((column) => (
                <Td key={column.label} scope="col" isNumeric>
                  {renderFrequency(
                    column.data[populationIndex + 1],
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
