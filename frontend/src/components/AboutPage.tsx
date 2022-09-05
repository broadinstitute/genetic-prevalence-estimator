import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
  Link,
  Text,
} from "@chakra-ui/react";
import { Link as RRLink } from "react-router-dom";

import DocumentTitle from "./DocumentTitle";

const AboutView = () => {
  return (
    <>
      <Text mb={2}>
        The genetic prevalence tool uses variant databases and population data
        to estimate prevalence for recessive diseases. This tool uses data from
        the open source databases{" "}
        <Link href="https://www.ncbi.nlm.nih.gov/clinvar/" isExternal>
          ClinVar
        </Link>{" "}
        and{" "}
        <Link href="https://gnomad.broadinstitute.org/" isExternal>
          gnomAD
        </Link>
        .
      </Text>

      <Text>
        The source code necessary to reproduce the analyses, is available on{" "}
        <Link
          href="https://github.com/broadinstitute/aggregate-frequency-calculator"
          isExternal
        >
          GitHub
        </Link>
        .
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Funding
      </Heading>
      <Text>
        Financial support for this tool is provided by the{" "}
        <Link href="https://the-tgg.org/" isExternal>
          Broad Institute
        </Link>{" "}
        and the{" "}
        <Link
          href="https://chanzuckerberg.com/science/programs-resources/rare-as-one/"
          isExternal
        >
          Chan Zuckerberg Initiative
        </Link>
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
        <Link
          href="https://creativecommons.org/publicdomain/zero/1.0/"
          isExternal
        >
          Creative Commons Zero Public Domain Dedication
        </Link>
        . This means that you can use it for any purpose without legally having
        to give attribution. However, we request that you actively acknowledge
        and give attribution to the gnomAD project
      </Text>

      <Heading as="h2" size="md" mt={4} mb={2}>
        Citation in Publications
      </Heading>
      <Text mb={2}>
        We request that any use of data obtained from the aggregate frequency
        calculator cite the online resource and include a link to the browser.
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
        <Link
          href="https://github.com/broadinstitute/aggregate-frequency-calculator/issues"
          isExternal
        >
          issue tracker
        </Link>
        . You can also reach us at{" "}
        <Link href="mailto:freq-calc@broadinstitute.org" isExternal>
          freq-calc@broadinstitute.org
        </Link>
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
