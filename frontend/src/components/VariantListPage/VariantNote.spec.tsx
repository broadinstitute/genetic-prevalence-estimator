import { render } from "@testing-library/react";

import { VariantNote } from "./VariantNote";

describe("VariantNote", () => {
  test("is a plus icon button icon if the user has edit permissions and there is no note", () => {
    const result = render(
      <VariantNote
        variantId={"testid123"}
        note={undefined}
        onEdit={() => {
          return;
        }}
        userCanEdit={true}
      />
    );
    expect(result.asFragment()).toMatchSnapshot();
  });

  test("is a pencil icon button icon if the user has edit permissions and there is a note", () => {
    const result = render(
      <VariantNote
        variantId={"testid234"}
        note={"hello world"}
        onEdit={() => {
          return;
        }}
        userCanEdit={true}
      />
    );
    expect(result.asFragment()).toMatchSnapshot();
  });

  test("is blank if the user does not have edit permissions and there is no note", () => {
    const result = render(
      <VariantNote
        variantId={"testid345"}
        note={undefined}
        onEdit={() => {
          return;
        }}
        userCanEdit={false}
      />
    );
    expect(result.asFragment()).toMatchSnapshot();
  });

  test("is an eyes icon if the user does not have edit permissions and there is a note", () => {
    const result = render(
      <VariantNote
        variantId={"testid456"}
        note={"hello world"}
        onEdit={() => {
          return;
        }}
        userCanEdit={false}
      />
    );
    expect(result.asFragment()).toMatchSnapshot();
  });
});
