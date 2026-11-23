import { Link, LinkProps } from "@chakra-ui/react";

const ExternalLink = (props: Omit<LinkProps, "isExternal">) => {
  return <Link isExternal {...props} />;
};

export default ExternalLink;
