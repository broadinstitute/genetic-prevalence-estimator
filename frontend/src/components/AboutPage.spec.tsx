import { expect, test } from "@jest/globals";
import { render } from "@testing-library/react";

import { withDummyRouter } from "../../tests/__helpers__/router";

import AboutPage from "./AboutPage";

test("About Page has no unexpected changes", () => {
  const result = render(withDummyRouter(<AboutPage />));
  expect(result.asFragment()).toMatchSnapshot();
});
