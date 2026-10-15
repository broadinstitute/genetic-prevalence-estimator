import { render } from "@testing-library/react";
import { variantListFactory } from "../../../tests/__factories__/VariantList";
import VariantsTable from "./VariantsTable";
import { TaggedGroups } from "../VariantListPage/VariantListPage";
import { GnomadVersion, VariantId, VariantList } from "../../types";

describe("Variant Table", () => {
  it.each(["4.1.1", "5.0.0"])(
    "renders variant IDs safely for version %s",
    (version) => {
      const testVariantList = variantListFactory.build() as VariantList;
      testVariantList.metadata.gnomad_version = version as GnomadVersion;
      const blankTaggedGroups: TaggedGroups = {
        A: { displayName: "", variantList: new Set<VariantId>() },
        B: { displayName: "", variantList: new Set<VariantId>() },
        C: { displayName: "", variantList: new Set<VariantId>() },
        D: { displayName: "", variantList: new Set<VariantId>() },
      };
      const result = render(
        <VariantsTable
          userCanEdit={false}
          includePopulationFrequencies={[]}
          searchText=""
          variantList={testVariantList}
          notIncludedVariants={new Set()}
          selectedVariants={new Set()}
          taggedGroups={blankTaggedGroups}
          shouldShowVariant={() => true}
          variantNotes={{}}
          onChangeSelectedVariants={() => {}}
          onChangeNotIncludedVariants={() => {}}
          onChangeTaggedGroups={() => {}}
          onEditVariantNote={() => {}}
        />
      );
      const variantLabel = result.getByText("12-123-A-C");
      const link = variantLabel.closest("a");
      if (version === "4.1.1") {
        expect(link?.getAttribute("href")).toBe(
          "https://gnomad.broadinstitute.org/variant/12-123-A-C?dataset=gnomad_r4"
        );
      } else {
        expect(link?.getAttribute("href")).toBe(
          "https://gnomad.broadinstitute.org/variant/12-123-A-C"
        );
      }
    }
  );

  it("has no unexpected changes", () => {
    const testVariantList = variantListFactory.build();
    const blankSet: Set<string> = new Set<string>();
    const blankTaggedGroups: TaggedGroups = {
      A: { displayName: "", variantList: new Set<VariantId>() },
      B: { displayName: "", variantList: new Set<VariantId>() },
      C: { displayName: "", variantList: new Set<VariantId>() },
      D: { displayName: "", variantList: new Set<VariantId>() },
    };
    const testSearchText = testVariantList.uuid;
    const result = render(
      <VariantsTable
        includePopulationFrequencies={[]}
        searchText={testSearchText}
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
