import { render } from "@testing-library/react";

import AnnotationTypeSelector from "./AnnotationTypeSelector";

describe("AnnotationTypeSelector", () => {
  test("is a single line of text about viewing shared annotations if the user does not have edit permissions", () => {
    const result = render(
      <AnnotationTypeSelector
        userCanEdit={false}
        value={"shared"}
        onChange={() => {
          return;
        }}
      />
    );
    expect(result.asFragment()).toMatchSnapshot();
  });

  test("is a component that allows selection between shared and personal annotations if the user has edit permissions", () => {
    const result = render(
      <AnnotationTypeSelector
        userCanEdit={true}
        value={"shared"}
        onChange={() => {
          return;
        }}
      />
    );
    expect(result.asFragment()).toMatchSnapshot();
  });
});
