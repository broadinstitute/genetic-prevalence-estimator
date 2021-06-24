import { Box, BoxProps } from "@chakra-ui/react";

export const DescriptionList = (props: BoxProps) => {
  const { children, ...rest } = props;
  return (
    <Box {...rest}>
      <dl>{children}</dl>
    </Box>
  );
};

interface DescriptionListItemProps extends BoxProps {
  label: string;
}

export const DescriptionListItem = (props: DescriptionListItemProps) => {
  const { children, label, ...rest } = props;
  return (
    <Box {...rest}>
      <dt
        style={{ display: "inline", marginRight: "0.5ch", fontWeight: "bold" }}
      >
        {label}:
      </dt>
      <dd style={{ display: "inline" }}>{children}</dd>
    </Box>
  );
};
