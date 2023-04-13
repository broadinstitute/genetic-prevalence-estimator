import { render } from "@testing-library/react";

import { withDummyRouter } from "../../tests/__helpers__/router";

import PageNotFoundPage from "./PageNotFoundPage";

describe("PageNotFoundPage", () => {
  it("has no unexpected changes", () => {
    const result = render(withDummyRouter(<PageNotFoundPage />));
    expect(result.asFragment()).toMatchSnapshot();
  });
});
