import { render } from "@testing-library/react";

import { withDummyRouter } from "../../tests/__helpers__/router";

import PublicVariantListsPage from "./PublicVariantListsPage";

describe("PageNotFoundPage", () => {
  it("has no unexpected changes", () => {
    const result = render(withDummyRouter(<PublicVariantListsPage />));
    expect(result.asFragment()).toMatchSnapshot();
  });
});
