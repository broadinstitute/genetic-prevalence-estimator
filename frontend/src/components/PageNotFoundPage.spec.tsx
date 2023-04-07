import { expect, test } from "@jest/globals";
import React from "react";
import renderer from "react-test-renderer";
import { withDummyRouter } from "../../tests/__helpers__/router";

import PageNotFoundPage from "./PageNotFoundPage";

test("About Page has no unexpected changes", () => {
  const tree = renderer.create(withDummyRouter(<PageNotFoundPage />));
  expect(tree).toMatchSnapshot();
});
