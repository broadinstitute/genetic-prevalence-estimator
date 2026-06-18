import { Box, Heading, Image, Link, Text, VStack } from "@chakra-ui/react";
import { Redirect } from "react-router-dom";

import DocumentTitle from "./DocumentTitle";
import SignInButton from "./SignInButton";
import { authStore, useStore } from "../state";

const GeneticSinkAnalogyPng = () => {
  return (
    <Box>
      <Image
        src="/genie-genetic-epidemiology-sink-analogy.png"
        alt="Genetic Epidemiology Sink Analogy"
        w="100%"
        h="auto"
      />
    </Box>
  );
};

const HomePage = () => {
  const { isSignedIn } = useStore(authStore);

  if (isSignedIn) {
    return <Redirect to="/variant-lists/" />;
  }

  return (
    <>
      <DocumentTitle />

      <Heading as="h1" mb={4}>
        GenIE, the Genetic Prevalence and Incidence Estimator
      </Heading>

      <Text mb={8}>
        GenIE, the Genetic Prevalence and Incidence Estimator, aims to aid in
        the estimation of genetic disorder frequency.
      </Text>

      <Box mb={8} ml={4}>
        <Text mb={4} fontWeight={"bold"}>
          Two ways to explore genetic disorder frequencies:
        </Text>

        <Box mb={4}>
          <Box>
            <Link href="/dashboard">GenIE Dashboard</Link> (
            <em>No sign in required</em>)
          </Box>
          <Text>
            GenIE offers a public dashboard for quick lookups. Search any
            disease-associated gene to see preliminary genetic prevalence
            estimates (autosomal recessive), publically shared curated genetic
            prevalence estimates, and genetic incidence de novo variation rates
            (GIDNV). Results are downloadable as CSV.
          </Text>
        </Box>

        <Box mb={4}>
          <Box>
            <Link href="/variant-lists">Variant list builder</Link> (
            <em>Sign in required</em>)
          </Box>
          <Text mb={4}>
            Produces carrier frequency and genetic prevalence estimates with
            full methodological transparency. Create curated variant lists using
            recommended (ClinVar + gnomAD) or manual (upload your own gnomAD
            IDs) workflows. Share variant lists privately with collaborators
            (with tiered permissions) or publicly through the dashboard.
          </Text>
          <Text mb={4}>Sign in with your Google account to get started.</Text>

          <Box mb={4}>
            <SignInButton />
          </Box>

          <Box mb={4}>
            <details>
              <summary>Why do I need to sign in?</summary>
              <Box borderLeftWidth="1px" borderColor="gray.400" pl={4} mt={2}>
                In order to store your variant lists, and allow you to edit them
                over time we need to have you signed in. By having users sign in
                we are also able to allow sharing lists across users, enabling
                collaboration.
              </Box>
            </details>
          </Box>
        </Box>
      </Box>

      <Box mb={16}>
        <Text>
          To learn more about the tool see our{" "}
          <Link href="/about">about page</Link>. To learn more about the methods
          and features available on GenIE please see our{" "}
          <Link href="/FAQ">FAQ</Link>.
        </Text>
      </Box>

      <VStack maxW="800px" mx="auto" spacing={4} textAlign="center" mb={12}>
        <GeneticSinkAnalogyPng />

        <Text fontStyle="italic">
          To illustrate these differences between the traditional prevalence and
          incidence and genetic prevalence and genetic incidence. To learn more
          about these methods please see our{" "}
          <Link href="https://gnomad.broadinstitute.org/news/2026-06-genie-incidence/">
            most recent blog post
          </Link>
          .
        </Text>
      </VStack>
    </>
  );
};

export default HomePage;
