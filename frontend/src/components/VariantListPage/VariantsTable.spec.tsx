import { render } from "@testing-library/react";
import { variantListFactory } from "../../../tests/__factories__/VariantList";
import VariantsTable from "./VariantsTable";
import { TaggedGroups } from "../VariantListPage/VariantListPage";
import { VariantId } from "../../types";

describe("Variant Table", () => {
  it("has no unexpected changes", () => {
    const testVariantList = variantListFactory.build();
    const blankSet: Set<string> = new Set<string>();
    const blankTaggedGroups: TaggedGroups = {
      A: { displayName: "", variantList: new Set<VariantId>() },
      B: { displayName: "", variantList: new Set<VariantId>() },
      C: { displayName: "", variantList: new Set<VariantId>() },
      D: { displayName: "", variantList: new Set<VariantId>() },
    };
    const result = render(
      <VariantsTable
        includePopulationFrequencies={[]}
        variantList={testVariantList}
        notIncludedVariants={blankSet}
        selectedVariants={new Set(["12-123-A-C", "12-234-A-C"])}
        taggedGroups={blankTaggedGroups}
        shouldShowVariant={() => true}
        variantNotes={{ "12-123-A-C": "note for test variant 12-123-A-C" }}
        onChangeSelectedVariants={() => {}}
        onChangeNotIncludedVariants={() => {}}
        onChangeTaggedGroups={(
          taggedGroups: TaggedGroups,
          variantId: VariantId
        ) => {}}
        onEditVariantNote={() => {}}
      />
    );
    expect(result.asFragment()).toMatchSnapshot();
  });
});
