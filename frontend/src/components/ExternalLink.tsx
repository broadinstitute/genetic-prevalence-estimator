import { Link, LinkProps } from "@chakra-ui/react";

const ExternalLink = (props: Omit<LinkProps, "isExternal">) => {
  // Chakra's isExternal sets only rel="noopener", which still sends a Referer.
  return <Link isExternal rel="noopener noreferrer" {...props} />;
};

export default ExternalLink;
