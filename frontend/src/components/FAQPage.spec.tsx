import { expect, test } from "@jest/globals";
import { render } from "@testing-library/react";

import { withDummyRouter } from "../../tests/__helpers__/router";

import FAQPage from "./FAQPage";

test("About Page has no unexpected changes", () => {
  const result = render(withDummyRouter(<FAQPage />));
  expect(result.asFragment()).toMatchSnapshot();
});
