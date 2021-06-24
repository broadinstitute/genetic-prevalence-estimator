import { Link as ChakraLink } from "@chakra-ui/react";
import { Link as RRLink, LinkProps } from "react-router-dom";

const Link = (props: LinkProps) => {
  return <ChakraLink as={RRLink} {...props} />;
};

export default Link;
