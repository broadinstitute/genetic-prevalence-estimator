import { expect, test } from "@jest/globals";
import { render } from "@testing-library/react";

import { withDummyRouter } from "../../tests/__helpers__/router";

import PageNotFoundPage from "./PageNotFoundPage";

test("About Page has no unexpected changes", () => {
  const result = render(withDummyRouter(<PageNotFoundPage />));
  expect(result.asFragment()).toMatchSnapshot();
});
