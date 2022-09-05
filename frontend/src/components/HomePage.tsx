import { Box, Heading, Link, Text } from "@chakra-ui/react";
import { Redirect } from "react-router-dom";

import SignInButton from "./SignInButton";
import { authStore, useStore } from "../state";

const HomePage = () => {
  const { isSignedIn } = useStore(authStore);

  if (isSignedIn) {
    return <Redirect to="/variant-lists/" />;
  }

  return (
    <>
      <Heading as="h1" mb={4}>
        Genetic Prevalence Calculator
      </Heading>

      <Text mb={8}>
        This tool aims to estimate carrier frequency and genetic prevalence for
        recessive conditions using allele frequencies from population data in
        gnomAD. We provide support for creating variant lists from{" "}
        <Link href="https://www.ncbi.nlm.nih.gov/clinvar/" isExternal>
          ClinVar
        </Link>{" "}
        and{" "}
        <Link href="https://gnomad.broadinstitute.org/" isExternal>
          gnomAD
        </Link>
        , or allow users to build their own custom list using gnomAD IDs. Sign
        in with your Google account to get started.
      </Text>

      <Box mb={4}>
        <SignInButton />
      </Box>

      <details>
        <summary>Why do I need to sign in?</summary>
        <Box borderLeftWidth="1px" borderColor="gray.400" pl={4} mt={2}>
          In order to store your variant lists, and allow you to edit them over
          time we need to have you signed in. By having users sign in we are
          also able to allow sharing lists across users, enabling collaboration.
        </Box>
      </details>
    </>
  );
};

export default HomePage;
