import { Heading, Text } from "@chakra-ui/react";

import DocumentTitle from "./DocumentTitle";

const PageNotFoundPage = () => {
  return (
    <>
      <DocumentTitle title="Page not found" />

      <Heading as="h1" mb={4}>
        Page not found
      </Heading>

      <Text>The page you requested does not exist.</Text>
    </>
  );
};

export default PageNotFoundPage;
