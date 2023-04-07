import { expect, test } from "@jest/globals";
import React from "react";
import renderer from "react-test-renderer";
import { withDummyRouter } from "../../tests/__helpers__/router";

import FAQPage from "./FAQPage";

test("About Page has no unexpected changes", () => {
  const tree = renderer.create(withDummyRouter(<FAQPage />));
  expect(tree).toMatchSnapshot();
});
