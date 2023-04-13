import { expect, test } from "@jest/globals";
import renderer from "react-test-renderer";
import { withDummyRouter } from "../../tests/__helpers__/router";

import AboutPage from "./AboutPage";

test("About Page has no unexpected changes", () => {
  const tree = renderer.create(withDummyRouter(<AboutPage />));
  expect(tree).toMatchSnapshot();
});
