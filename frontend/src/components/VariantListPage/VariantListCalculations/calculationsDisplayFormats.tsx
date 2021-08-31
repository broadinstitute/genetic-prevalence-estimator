import {
  FormControl,
  FormLabel,
  HStack,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";

export type DisplayFormat = "scientific" | "fraction";

const renderFrequencyScientific = (f: number) => {
  const truncated = Number(f.toPrecision(3));
  if (truncated === 0 || truncated === 1) {
    return f.toFixed(0);
  } else {
    return truncated.toExponential(2);
  }
};

const renderFrequencyFraction = (f: number) => {
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {f === 0 ? "–" : `1 / ${Math.round(1 / f).toLocaleString()}`}
    </span>
  );
};

export const renderFrequency = (f: number, format: DisplayFormat) => {
  if (format === "scientific") {
    return renderFrequencyScientific(f);
  }
  if (format === "fraction") {
    return renderFrequencyFraction(f);
  }
};

interface DisplayFormatInputProps {
  value: DisplayFormat;
  onChange: (value: DisplayFormat) => void;
}

export const DisplayFormatInput = (props: DisplayFormatInputProps) => {
  const { value, onChange } = props;
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
          <Radio value="scientific">Scientific</Radio>
        </HStack>
      </RadioGroup>
    </FormControl>
  );
};
