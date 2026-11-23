import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
  Text,
} from "@chakra-ui/react";
import { Link as RRLink } from "react-router-dom";

import DocumentTitle from "./DocumentTitle";
import ExternalLink from "./ExternalLink";

const AboutView = () => {
  return (
    <>
      <Text mb={2}>
        GenIE, the Genetic Prevalence and Incidence Estimator, uses variant
        databases and population data to estimate genetic prevalence and genetic
        incidence for genetic diseases. This tool uses data from the open source
        databases{" "}
        <ExternalLink href="https://www.ncbi.nlm.nih.gov/clinvar/">
          ClinVar
        </ExternalLink>{" "}
        and{" "}
        <ExternalLink href="https://gnomad.broadinstitute.org/">
          gnomAD
        </ExternalLink>
        .
      </Text>

      <Text>
        The source code necessary to reproduce the analyses is available on{" "}
        <ExternalLink href="https://github.com/broadinstitute/genetic-prevalence-estimator">
          GitHub
        </ExternalLink>
        .
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Funding
      </Heading>
      <Text>
        Financial support for this tool is provided by the{" "}
        <ExternalLink href="https://the-tgg.org/">Broad Institute</ExternalLink>{" "}
        and the{" "}
        <ExternalLink href="https://chanzuckerberg.com/science/programs-resources/rare-as-one/">
          Chan Zuckerberg Initiative
        </ExternalLink>
        .
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Data Use
      </Heading>
      <Text>
        All data here are released openly and publicly for the benefit of the
        wider biomedical community. There are absolutely no restrictions or
        embargoes on the publication of results derived from this tool. The data
        pulled from gnomAD and this tool are available free of restrictions
        under the{" "}
        <ExternalLink href="https://creativecommons.org/publicdomain/zero/1.0/">
          Creative Commons Zero Public Domain Dedication
        </ExternalLink>
        . This means that you can use it for any purpose without legally having
        to give attribution. However, we request that you actively acknowledge
        and give attribution to the gnomAD project
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Citation in Publications
      </Heading>
      <Text mb={2}>
        We request that any use of data obtained from GenIE cite the online
        resource and include a link to the tool ({document.location.hostname}).
      </Text>

      <Text mb={2}>
        For manuscripts we request that you cite our{" "}
        <ExternalLink href="https://www.medrxiv.org/content/10.64898/2026.03.30.26349539v1">
          preprint
        </ExternalLink>
        :
        <Text mt={2} mb={2} as="div">
          Baxter SM, Singer-Berk M, Glaze C, et al. The power of partnership:
          Democratizing genetic prevalence to empower patient advocacy. medRxiv.
          Published online March 31, 2026:2026.03.30.26349539.
          doi:10.64898/2026.03.30.26349539
        </Text>
      </Text>

      <Text>
        There is no need to include us as authors on your manuscript, unless we
        contributed specific advice or analysis for your work.
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Contact
      </Heading>
      <Text>
        Please report any issues using the{" "}
        <ExternalLink href="https://github.com/broadinstitute/genetic-prevalence-estimator/issues">
          issue tracker
        </ExternalLink>
        . You can also reach us at{" "}
        <ExternalLink href="mailto:prev-genie@broadinstitute.org">
          prev-genie@broadinstitute.org
        </ExternalLink>
        .
      </Text>
    </>
  );
};

const AboutPage = () => {
  return (
    <>
      <DocumentTitle title="About" />

      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <span>About</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        About
      </Heading>

      <AboutView />
    </>
  );
};

export default AboutPage;
