import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "@chakra-ui/react";
import { Link as RRLink } from "react-router-dom";

import CustomVariantListForm from "./CustomVariantListForm";
import GnomadVariantListForm from "./GnomadVariantListForm";

const CreateVariantListPage = () => {
  return (
    <>
      <Box mb={2}>
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/">
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink as={RRLink} to="/variant-lists/">
              Variant Lists
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <span>New variant list</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        New variant list
      </Heading>

      <Tabs>
        <TabList>
          <Tab>gnomAD</Tab>
          <Tab>Custom</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <GnomadVariantListForm />
          </TabPanel>
          <TabPanel>
            <CustomVariantListForm />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  );
};

export default CreateVariantListPage;