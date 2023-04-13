import { expect, test } from "@jest/globals";
import renderer from "react-test-renderer";
import { withDummyRouter } from "../../tests/__helpers__/router";

import HomePage from "./HomePage";

test("About Page has no unexpected changes", () => {
  const tree = renderer.create(withDummyRouter(<HomePage />));
  expect(tree).toMatchSnapshot();
});
