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

import DocumentTitle from "../DocumentTitle";

import CustomVariantListForm from "./CustomVariantListForm";
import RecommendedVariantListForm from "./RecommendedVariantListForm";

const CreateVariantListPage = () => {
  return (
    <>
      <DocumentTitle title="New variant list" />

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
          <Tab>Recommended</Tab>
          <Tab>Custom</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <RecommendedVariantListForm />
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
