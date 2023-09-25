import { Factory } from "fishery";
import { VariantList, VariantListType } from "../../src/types";

export const variantListFactory = Factory.define<VariantList>(({ params }) => {
  const {
    uuid = "123456789",
    label = "test variant list",
    notes = "this variant list is used for testing",
    type = VariantListType.RECOMMENDED,
    metadata = { gnomad_version: "2.1.1" },
    created_at = "2023-01-01",
    updated_at = "2023-01-02",
    status = "Ready",
    variants = [
      { id: "12-123-A-C" },
      { id: "12-234-A-C" },
      { id: "12-345-A-C" },
      { id: "12-456-A-C" },
      { id: "12-567-A-C" },
    ],
  } = params;
  return {
    uuid,
    label,
    notes,
    type,
    metadata,
    created_at,
    updated_at,
    status,
    variants,
  };
});
