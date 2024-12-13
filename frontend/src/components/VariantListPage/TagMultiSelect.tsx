import { useState } from "react";
import { MultiSelect } from "react-multi-select-component";
import { TaggedGroups, TagKey } from "./VariantListPage";
import { VariantId } from "../../types";

type TagMultiSelectProps = {
  taggedGroups: TaggedGroups;
  rowDataId: VariantId;
  onChangeTaggedGroups: (
    rowDataId: VariantId,
    updatedGroups: TaggedGroups
  ) => void;
};

export const TagMultiSelect = (props: TagMultiSelectProps) => {
  const { taggedGroups, rowDataId, onChangeTaggedGroups } = props;

  const options = [
    { label: taggedGroups.A.displayName, value: "A" },
    { label: taggedGroups.B.displayName, value: "B" },
    { label: taggedGroups.C.displayName, value: "C" },
    { label: taggedGroups.D.displayName, value: "D" },
  ];

  const [selected, setSelected] = useState(
    options.filter((option) =>
      taggedGroups[option.value as TagKey]?.variantList.has(rowDataId)
    )
  );

  const handleSelectChange = (
    selectedOptions: { label: string; value: TagKey }[]
  ) => {
    const newTaggedGroups = { ...taggedGroups };
    const selectedTags = selectedOptions.map((option) => option.value);

    (Object.keys(taggedGroups) as TagKey[]).forEach((tagKey) => {
      const updatedTagGroup = {
        ...newTaggedGroups[tagKey],
        variantList: new Set(taggedGroups[tagKey]?.variantList || []),
      };

      if (selectedTags.includes(tagKey)) {
        updatedTagGroup.variantList.add(rowDataId);
      } else {
        updatedTagGroup.variantList.delete(rowDataId);
      }

      newTaggedGroups[tagKey] = updatedTagGroup;
    });

    setSelected(selectedOptions);
    onChangeTaggedGroups(rowDataId, newTaggedGroups);
  };

  const overrideStrings = {
    allItemsAreSelected: "All tags are selected",
    clearSearch: "Clear Search",
    noOptions: "No options",
    search: "Search",
    selectAll: "Select All",
    selectSomeItems: "Select tags...",
  };

  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start" }}
    >
      <MultiSelect
        options={options}
        value={selected}
        onChange={handleSelectChange}
        labelledBy="Select Tags"
        overrideStrings={overrideStrings}
      />
    </div>
  );
};
