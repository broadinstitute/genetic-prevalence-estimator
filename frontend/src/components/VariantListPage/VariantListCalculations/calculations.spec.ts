import { Variant, VariantList } from "../../../types";
import { calculateCarrierFrequencyAndPrevalence } from "./calculations";

import testDataJson from "../../../../../data-pipelines/tests/calculationsData.json";

describe("calculations", () => {
  it("calculates the expected values given a list of variants", () => {
    const result = calculateCarrierFrequencyAndPrevalence(
      testDataJson.variants as Variant[],
      (testDataJson.variant_list as unknown) as VariantList
    );

    // Rename the fields for consistency across frontend and backend to
    //   allow for testing of correctness of implementations across
    //   python/javascript, while maintaining standards of naming
    const renamedResult = {
      carrier_frequency: result.carrierFrequency,
      carrier_frequency_simplified: result.carrierFrequencySimplified,
      carrier_frequency_raw_numbers: result.carrierFrequencyRawNumbers,
      prevalence: result.prevalence,
    };

    expect(renamedResult).toEqual(testDataJson.expected_results);
  });
});
