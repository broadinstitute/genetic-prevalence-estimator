import {
  Link as ChakraLink,
  LinkProps as ChakraLinkProps,
} from "@chakra-ui/react";
import { Link as RRLink, LinkProps as RRLinkProps } from "react-router-dom";

type LinkProps = ChakraLinkProps & RRLinkProps;

const Link = (props: LinkProps) => {
  return <ChakraLink as={RRLink} {...props} />;
};

export default Link;
