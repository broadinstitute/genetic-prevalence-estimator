import { render } from "@testing-library/react";

import { variantListFactory } from "../../../tests/__factories__/VariantList";

import VariantsTable from "./VariantsTable";

describe("Variant Table", () => {
  it("has no unexpected changes", () => {
    const testVariantList = variantListFactory.build();
    const result = render(
      <VariantsTable
        includePopulationFrequencies={[]}
        variantList={testVariantList}
        selectedVariants={new Set(["12-123-A-C", "12-234-A-C"])}
        shouldShowVariant={() => true}
        variantNotes={{ "12-123-A-C": "note for test variant 12-123-A-C" }}
        onChangeSelectedVariants={() => {}}
        onEditVariantNote={() => {}}
      />
    );
    expect(result.asFragment()).toMatchSnapshot();
  });
});
