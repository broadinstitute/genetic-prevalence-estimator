import {
  FormControl,
  FormLabel,
  HStack,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";

export type DisplayFormat =
  | "scientific"
  | "fraction"
  | "fraction_of_100000"
  | "raw_numbers";

export const renderFrequencyScientific = (f: number) => {
  const truncated = Number(f.toPrecision(3));
  if (truncated === 0 || truncated === 1) {
    return f.toFixed(0);
  } else {
    return truncated.toExponential(2);
  }
};

export const renderFrequencyFraction = (f: number) => {
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {f === 0 ? "–" : `1 / ${Math.round(1 / f).toLocaleString()}`}
    </span>
  );
};

export const calculateFrequencyFractionOver100000 = (
  f: number,
  decimals: number | undefined
) => {
  return ((f * 100_000 * 1_000) / 1_000).toFixed(decimals).toLocaleString();
};

export const formatFrequencyFractionOver100000 = (
  f: number,
  decimals: number | undefined
) => {
  return f === 0
    ? "-"
    : `${calculateFrequencyFractionOver100000(f, decimals || 3)} / 100,000`;
};

export const renderFrequencyFractionOver100000 = (f: number) => {
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {f === 0
        ? "-"
        : `${calculateFrequencyFractionOver100000(f, 3)} / 100,000`}
    </span>
  );
};

export type RawCarrierFrequencyData = {
  total_ac: number;
  average_an: number;
};

export const renderFrequencyRawNumbers = (f: RawCarrierFrequencyData) => {
  return `${f.total_ac.toFixed(0)} / ${f.average_an.toFixed(0)}`;
};

export const renderFrequency = (
  f: number | RawCarrierFrequencyData,
  format: DisplayFormat
) => {
  if (format === "scientific") {
    return renderFrequencyScientific(f as number);
  }
  if (format === "fraction") {
    return renderFrequencyFraction(f as number);
  }
  if (format === "fraction_of_100000") {
    return renderFrequencyFractionOver100000(f as number);
  }

  if (format === "raw_numbers") {
    return renderFrequencyRawNumbers(f as RawCarrierFrequencyData);
  }
};

interface DisplayFormatInputProps {
  value: DisplayFormat;
  onChange: (value: DisplayFormat) => void;
  includeFractionOf100000?: boolean;
}

export const DisplayFormatInput = ({
  value,
  onChange,
  includeFractionOf100000 = false,
}: DisplayFormatInputProps) => {
  return (
    <FormControl id="calculations-display-format" as="fieldset">
      <FormLabel as="legend">Display format</FormLabel>
      <RadioGroup
        value={value}
        onChange={(value) => {
          onChange(value as DisplayFormat);
        }}
      >
        <HStack spacing="24px">
          <Radio value="fraction">Fraction</Radio>
          <Radio value="scientific">Scientific notation</Radio>
          {includeFractionOf100000 && (
            <Radio value="fraction_of_100000">Fraction of 100,000</Radio>
          )}
        </HStack>
      </RadioGroup>
    </FormControl>
  );
};
