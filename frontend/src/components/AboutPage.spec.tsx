import { render } from "@testing-library/react";

import { withDummyRouter } from "../../tests/__helpers__/router";

import AboutPage from "./AboutPage";

describe("AboutPage", () => {
  it("has no unexpected changes", () => {
    const result = render(withDummyRouter(<AboutPage />));
    expect(result.asFragment()).toMatchSnapshot();
  });
});
