import { expect, test } from "@jest/globals";
import { render } from "@testing-library/react";

import { withDummyRouter } from "../../tests/__helpers__/router";

import HomePage from "./HomePage";

jest.mock("./SignInButton");

test("About Page has no unexpected changes", () => {
  const result = render(withDummyRouter(<HomePage />));
  expect(result.asFragment()).toMatchSnapshot();
});
