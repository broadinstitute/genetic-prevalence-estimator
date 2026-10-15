import { getGnomadVariantUrl } from "./gnomadVariantUrl";

it.each([
  ["2.1.1", "gnomad_r2_1"],
  ["3.1.2", "gnomad_r3"],
  ["4.0.0", "gnomad_r4"],
  ["4.1.0", "gnomad_r4"],
  ["4.1.1", "gnomad_r4"],
  ["4.1.2", "gnomad_r4"],
  ["4.2.0", "gnomad_r4"],
  ["4.0.0_non-ukb", "gnomad_r4"],
  ["4.1.0_non-ukb", "gnomad_r4"],
])("links small variants in %s to %s", (version, dataset) => {
  expect(getGnomadVariantUrl("12-123-A-C", version)).toBe(
    `https://gnomad.broadinstitute.org/variant/12-123-A-C?dataset=${dataset}`
  );
});

it.each(["4.0.0", "4.1.0", "4.1.1", "4.1.2", "4.1.0_non-ukb"])(
  "links structural variants in %s to the SV dataset",
  (version) => {
    expect(getGnomadVariantUrl("del_chr1_ab12", version)).toBe(
      "https://gnomad.broadinstitute.org/variant/DEL_CHR1_AB12?dataset=gnomad_sv_r4"
    );
  }
);

it("preserves v2 structural variant links", () => {
  expect(getGnomadVariantUrl("del_1_123", "2.1.1")).toBe(
    "https://gnomad.broadinstitute.org/variant/DEL_1_123?dataset=gnomad_sv_r2_1"
  );
});

it.each(["", "4", "4.1", "4.1.1junk", "5.0.0", "40.1.0"])(
  "omits the dataset for unsupported or malformed version %s",
  (version) => {
    expect(getGnomadVariantUrl("12-123-A-C", version)).toBe(
      "https://gnomad.broadinstitute.org/variant/12-123-A-C"
    );
  }
);
