import { render } from "@testing-library/react";

import { withDummyRouter } from "../../tests/__helpers__/router";

import FAQPage from "./FAQPage";

describe("FAQPage", () => {
  it("has no unexpected changes", () => {
    const result = render(withDummyRouter(<FAQPage />));
    expect(result.asFragment()).toMatchSnapshot();
  });
});
