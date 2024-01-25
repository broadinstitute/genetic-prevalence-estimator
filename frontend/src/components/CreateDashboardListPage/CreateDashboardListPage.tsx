import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Heading,
} from "@chakra-ui/react";
import { Link as RRLink } from "react-router-dom";

import DashboardListForm from "./DashboardListForm";

import DocumentTitle from "../DocumentTitle";

const CreateDashboardListPage = () => {
  return (
    <>
      <DocumentTitle title="New dashboard list" />

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
            <span>New dashboard list</span>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>
      <Heading as="h1" mb={4}>
        New dashboard list
      </Heading>

      <DashboardListForm />
    </>
  );
};

export default CreateDashboardListPage;
