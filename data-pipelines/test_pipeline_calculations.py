import json
import os
import math

from generate_dashboard_lists import calculate_carrier_frequency_and_prevalence


def assert_dictionaries_are_equal_with_tolerance(result, expected, tolerance=1e-9):
    for key in expected:
        if isinstance(expected[key], list):
            for i in range(len(expected[key])):
                if isinstance(expected[key][i], float):
                    assert math.isclose(
                        result[key][i], expected[key][i], rel_tol=tolerance
                    ), f"Key: {key}, Index: {i}"
                else:
                    assert result[key][i] == expected[key][i], f"Key: {key}, Index: {i}"
        elif isinstance(expected[key], dict):
            for sub_key in expected[key]:
                assert (
                    result[key][sub_key] == expected[key][sub_key]
                ), f"Key: {key}, Subkey: {sub_key}"
        else:
            assert result[key] == expected[key], f"Key: {key}"


def test_calculations():
    current_dir = os.path.dirname(__file__)
    path_to_json = os.path.join(current_dir, "tests/calculationsData.json")
    with open(path_to_json, "r") as f:
        test_data = json.load(f)

    variants = test_data["variants"]
    populations = test_data["variant_list"]["metadata"]["populations"]

    expected = test_data["expected_results"]
    result = calculate_carrier_frequency_and_prevalence(variants, populations)

    assert_dictionaries_are_equal_with_tolerance(result, expected)
