import {
  Box,
  HStack,
  Tooltip,
  useDimensions,
  useMediaQuery,
} from "@chakra-ui/react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { LegendOrdinal } from "@visx/legend";
import { scaleBand, scaleLinear, scaleOrdinal } from "@visx/scale";
import { Bar, BarGroup } from "@visx/shape";
import React, { useRef } from "react";

import theme from "../../../theme";
import { GNOMAD_POPULATION_NAMES } from "../../../constants/populations";
import { GnomadPopulationId } from "../../../types";

import {
  DisplayFormat,
  renderFrequency,
  renderFrequencyScientific,
} from "./calculationsDisplayFormats";

type Series = {
  label: string;
  data: number[];
};

interface BarGraphProps {
  populations: GnomadPopulationId[];
  series: Series[];
  label: string;
  displayFormat: DisplayFormat;
  width?: number;
  height?: number;
}

const margin = {
  top: 20,
  right: 20,
  bottom: 110,
  left: 60,
};

const BarGraph = (props: BarGraphProps) => {
  const {
    populations,
    series,
    width = 400,
    height = 300,
    label,
    displayFormat,
  } = props;

  const data = [
    {
      population: "Global",
      ...series.reduce((acc, s) => ({ ...acc, [s.label]: s.data[0] }), {}),
    },
    ...populations.map((population, i) => ({
      population: population,
      ...series.reduce((acc, s) => ({ ...acc, [s.label]: s.data[i + 1] }), {}),
    })),
  ];

  const xScale = scaleBand({
    domain: ["Global", ...populations],
    range: [0, width - (margin.left + margin.right)],
    padding: 0.2,
  });

  const xBandwidth = xScale.bandwidth();

  const groupScale = scaleBand({
    domain: series.map((s) => s.label),
    range: [0, xBandwidth],
    round: true,
  });

  const colorScale = scaleOrdinal({
    domain: series.map((s) => s.label),
    range: [
      theme.colors.blue["600"], // All
      theme.colors.purple["600"], // ClinVar only
      theme.colors.red["600"], // gnomAD only
    ],
  });

  const yScale = scaleLinear({
    domain: [
      0,
      series.flatMap((s) => s.data).reduce((acc, d) => Math.max(acc, d)),
    ],
    range: [height - (margin.top + margin.bottom), 0],
    round: true,
  });

  return (
    <figure>
      <figcaption>{label}</figcaption>
      {series.length > 1 && (
        <Box
          sx={{
            "& .visx-legend-label": {
              fontSize: 11,
            },
          }}
        >
          <LegendOrdinal
            scale={colorScale}
            direction="row"
            labelMargin="0 15px 0 0"
          />
        </Box>
      )}
      <svg width={width} height={height}>
        <Group top={margin.top} left={margin.left}>
          <BarGroup
            keys={series.map((s) => s.label)}
            data={data}
            x0={(d) => d.population}
            x0Scale={xScale}
            x1Scale={groupScale}
            yScale={yScale}
            color={colorScale}
            height={height - (margin.top + margin.bottom)}
          >
            {(barGroups) =>
              barGroups.map((barGroup) => {
                const population = xScale.domain()[barGroup.index];
                return (
                  <Group key={`group-${barGroup.index}`} left={barGroup.x0}>
                    <Tooltip
                      label={
                        <div style={{ padding: "0.5em" }}>
                          <strong>
                            {GNOMAD_POPULATION_NAMES[
                              population as GnomadPopulationId
                            ] || population}
                          </strong>
                          <dl>
                            {barGroup.bars.map((bar) => (
                              <React.Fragment key={bar.key}>
                                <HStack>
                                  <dt>{bar.key}</dt>
                                  <dd>
                                    {renderFrequency(bar.value, displayFormat)}
                                  </dd>
                                </HStack>
                              </React.Fragment>
                            ))}
                          </dl>
                        </div>
                      }
                      maxWidth="500px"
                    >
                      <rect
                        x={0}
                        y={0}
                        width={xBandwidth}
                        height={height - (margin.top + margin.bottom)}
                        fill="none"
                        pointerEvents="all"
                      />
                    </Tooltip>
                    {barGroup.bars.map((bar) => (
                      <Bar
                        key={bar.key}
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        fill={bar.color}
                        stroke="#333"
                        strokeWidth={1}
                        pointerEvents="none"
                      />
                    ))}
                  </Group>
                );
              })
            }
          </BarGroup>

          <AxisLeft
            scale={yScale}
            stroke="#333"
            tickFormat={(d) => renderFrequencyScientific(d.valueOf())}
            tickStroke="#333"
            tickLabelProps={() => ({
              fill: "#333",
              fontSize: 11,
              textAnchor: "end",
              dx: "-0.25em",
              dy: "0.33em",
            })}
          />

          <AxisBottom
            top={height - (margin.top + margin.bottom)}
            scale={xScale}
            stroke="#333"
            tickFormat={(d) =>
              GNOMAD_POPULATION_NAMES[d as GnomadPopulationId] || d
            }
            tickStroke="#333"
            tickLabelProps={(d) => ({
              dx: "-0.75em",
              dy: "0.25em",
              fill: "#000",
              fontSize: 10,
              textAnchor: "end",
              transform: `translate(0, 0), rotate(-40 ${
                xScale(d)! + xBandwidth / 2
              }, 0)`,
            })}
          />
        </Group>
      </svg>
    </figure>
  );
};

const AutosizedBarGraph = (props: Omit<BarGraphProps, "height" | "width">) => {
  const ref = useRef<HTMLDivElement>(null);

  const dimensions = useDimensions(ref, true);

  const [oneColumn] = useMediaQuery("(max-width: 600px)");

  return (
    <Box
      ref={ref}
      width={oneColumn ? "100%" : "calc(50% - 20px)"}
      maxWidth="600px"
    >
      {dimensions && (
        <BarGraph {...props} width={dimensions.contentBox.width} height={300} />
      )}
    </Box>
  );
};

export default AutosizedBarGraph;
