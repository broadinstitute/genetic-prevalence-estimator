import { Box, HStack, Tooltip, useDimensions } from "@chakra-ui/react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { LegendOrdinal } from "@visx/legend";
import { scaleBand, scaleLinear, scaleOrdinal } from "@visx/scale";
import { Bar, BarStack } from "@visx/shape";
import { interpolateLab } from "d3-interpolate";
import { useRef } from "react";

import theme from "../../../theme";
import {
  GNOMAD_POPULATION_NAMES,
  isSubcontinentalPopulation,
} from "../../../constants/populations";
import { GnomadPopulationId } from "../../../types";

import {
  DisplayFormat,
  renderFrequency,
  renderFrequencyScientific,
} from "./calculationsDisplayFormats";

type Series = {
  label: string;
  color?: string;
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

  const data = populations.map((population, i) => ({
    population: population,
    ...series.reduce(
      (acc, s) => ({
        ...acc,
        ...(isSubcontinentalPopulation(population)
          ? {
              [s.label]: 0,
              [`${s.label} (subcontinental)`]: s.data[i],
            }
          : {
              [s.label]: s.data[i],
              [`${s.label} (subcontinental)`]: 0,
            }),
      }),
      {}
    ),
  }));

  const xScale = scaleBand({
    domain: populations,
    range: [0, width - (margin.left + margin.right)],
    padding: 0.2,
  });

  const xBandwidth = xScale.bandwidth();

  const colorScale = scaleOrdinal({
    domain: series.flatMap((s) => [s.label, `${s.label} (subcontinental)`]),
    range: series.flatMap((s) => [
      s.color || theme.colors.blue["600"],
      interpolateLab(s.color || theme.colors.blue["600"], "#fff")(0.5),
    ]),
  });

  const yScale = scaleLinear({
    domain: [
      0,
      series.flatMap((s) => s.data).reduce((acc, d) => Math.max(acc, d)) || 1,
    ],
    range: [height - (margin.top + margin.bottom), 0],
    round: true,
  });

  const tickFormat =
    displayFormat === "scientific"
      ? (d: { valueOf(): number }) => renderFrequencyScientific(d.valueOf())
      : (d: { valueOf(): number }) => {
          const n = d.valueOf();
          if (n === 0) {
            return "0";
          }
          const denominator = Math.round(1 / n);
          if (denominator >= 1e9) {
            return `1 / ${(denominator / 1e9).toPrecision(3)}B`;
          }
          if (denominator >= 1e6) {
            return `1 / ${(denominator / 1e6).toPrecision(3)}M`;
          }
          if (denominator >= 1e3) {
            return `1 / ${(denominator / 1e3).toPrecision(3)}K`;
          }
          return `1 / ${denominator}`;
        };

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
          <BarStack
            keys={series.flatMap((s) => [
              s.label,
              `${s.label} (subcontinental)`,
            ])}
            data={data}
            x={(d) => d.population}
            xScale={xScale}
            yScale={yScale}
            color={colorScale}
            height={height - (margin.top + margin.bottom)}
          >
            {(barStacks) => {
              return (
                <>
                  {data
                    .map((d) => d.population)
                    .map((population, populationIndex) => {
                      return (
                        <Tooltip
                          key={population}
                          label={
                            <div style={{ padding: "0.5em" }}>
                              <strong>
                                {GNOMAD_POPULATION_NAMES[population]}
                              </strong>
                              <dl>
                                {series.map((s) => (
                                  <HStack key={s.label}>
                                    <dt>{s.label}</dt>
                                    <dd>
                                      {renderFrequency(
                                        s.data[populationIndex],
                                        displayFormat
                                      )}
                                    </dd>
                                  </HStack>
                                ))}
                              </dl>
                            </div>
                          }
                          maxWidth="500px"
                        >
                          <rect
                            x={xScale(population)}
                            y={0}
                            width={xBandwidth}
                            height={height - (margin.top + margin.bottom)}
                            fill="none"
                            pointerEvents="all"
                          />
                        </Tooltip>
                      );
                    })}

                  {barStacks.map((barStack) => {
                    return barStack.bars.map((bar) => (
                      <Bar
                        key={`${barStack.key}-${bar.index}`}
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        fill={bar.color}
                        stroke="#333"
                        strokeWidth={1}
                        pointerEvents="none"
                      />
                    ));
                  })}
                </>
              );
            }}
          </BarStack>

          <AxisLeft
            scale={yScale}
            stroke="#333"
            tickFormat={tickFormat}
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
            numTicks={populations.length}
            tickFormat={(d) => GNOMAD_POPULATION_NAMES[d]}
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

  return (
    <Box ref={ref} width="100%">
      {dimensions && (
        <BarGraph {...props} width={dimensions.contentBox.width} height={300} />
      )}
    </Box>
  );
};

export default AutosizedBarGraph;
