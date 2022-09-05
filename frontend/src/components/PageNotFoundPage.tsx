import { Heading, Text } from "@chakra-ui/react";

const PageNotFoundPage = () => {
  return (
    <>
      <Heading as="h1" mb={4}>
        Page not found
      </Heading>

      <Text>The page you requested does not exist.</Text>
    </>
  );
};

export default PageNotFoundPage;
