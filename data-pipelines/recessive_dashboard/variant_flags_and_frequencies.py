import math


VARIANT_FLAG_CALCULATION_FIELDS = ("clinical_significance_category", "_freq_missing")


def _first_allele_frequency(variant):
    allele_counts = variant.get("AC")
    allele_numbers = variant.get("AN")
    if not allele_counts or not allele_numbers:
        return None

    allele_count = allele_counts[0]
    allele_number = allele_numbers[0]
    if allele_count is None or allele_number is None:
        return None

    if allele_number == 0:
        return float("nan") if allele_count == 0 else float("inf")
    return allele_count / allele_number


def _max_af_of_clinvar_pathogenic_variants(variants):
    candidate_allele_frequencies = []
    for variant in variants:
        if (
            variant.get("clinical_significance_category")
            != "pathogenic_or_likely_pathogenic"
        ):
            continue

        allele_frequency = _first_allele_frequency(variant)
        if allele_frequency is not None:
            candidate_allele_frequencies.append(allele_frequency)

    if not candidate_allele_frequencies:
        return None

    finite_allele_frequencies = [
        af for af in candidate_allele_frequencies if not math.isnan(af)
    ]
    return max(finite_allele_frequencies) if finite_allele_frequencies else float("nan")


def _flags_for_variant(variant, max_af_of_clinvar_path_or_likely_path_variants):
    flags = []

    if variant.get("_freq_missing"):
        flags.append("not_found")

    filters = variant.get("filters") or {}
    exome_filters = set(filters.get("exome") or [])
    genome_filters = set(filters.get("genome") or [])
    if len(exome_filters | genome_filters) > 0:
        flags.append("filtered")

    allele_frequency = _first_allele_frequency(variant)
    if (
        allele_frequency is not None
        and allele_frequency > max_af_of_clinvar_path_or_likely_path_variants
        and variant.get("clinvar_variation_id") is None
    ):
        flags.append("high_AF")

    # TODO: add "low_AN" flag?
    homozygote_counts = variant.get("homozygote_count")
    if homozygote_counts and (homozygote_counts[0] or 0) > 0:
        flags.append("has_homozygotes")

    return flags


def flag_and_filter_variants(variants):
    max_af_of_clinvar_path_or_likely_path_variants = (
        _max_af_of_clinvar_pathogenic_variants(variants)
    )
    # No AF exceeds 1, so high_AF cannot fire without a ClinVar P/LP threshold.
    if max_af_of_clinvar_path_or_likely_path_variants is None:
        max_af_of_clinvar_path_or_likely_path_variants = 1

    for variant in variants:
        variant["flags"] = _flags_for_variant(
            variant, max_af_of_clinvar_path_or_likely_path_variants
        )

    variants = [v for v in variants if "filtered" not in v["flags"]]

    for variant in variants:
        for temp_field in VARIANT_FLAG_CALCULATION_FIELDS:
            variant.pop(temp_field, None)

    return variants


def select_top_ten_variants(variants):
    valid_variants = [
        v for v in variants if v.get("AN") and v["AN"][0] > 0 and v.get("AC")
    ]

    sorted_variants = sorted(
        valid_variants, key=lambda v: v["AC"][0] / v["AN"][0], reverse=True
    )

    return sorted_variants[:10]


def calculate_carrier_frequency_and_prevalence(variants, populations):
    variant_count = len(variants)
    if variant_count == 0:
        print("For this gene, variants length is 0")

    # calculate sum of allele frequencies across all variants
    total_allele_frequencies = [0] * (len(populations) + 1)
    multiplied_allele_frequencies = [1] * (len(populations) + 1)

    for variant in variants:
        allele_frequencies = []
        if variant["AC"]:
            for index_ac, allele_count in enumerate(variant["AC"]):
                allele_number = variant["AN"][index_ac]
                allele_frequency = (
                    0 if allele_number == 0 else allele_count / allele_number
                )
                allele_frequencies.append(allele_frequency)
                total_allele_frequencies[index_ac] = (
                    total_allele_frequencies[index_ac] + allele_frequency
                )
                multiplied_allele_frequencies[index_ac] = multiplied_allele_frequencies[
                    index_ac
                ] * (1 - allele_frequency)

    # calculate total summary frequency and prevalence
    carrier_frequency_array = []
    carrier_frequency_simplified_array = []
    prevalence_array = []
    for q in total_allele_frequencies:
        carrier_frequency = 2 * (1 - q) * q
        carrier_frequency_array.append(carrier_frequency)

        carrier_frequency_simplified = 2 * q
        carrier_frequency_simplified_array.append(carrier_frequency_simplified)

        prevalence = q**2
        prevalence_array.append(prevalence)

    # TODO: combine these two into one after tests pass?
    total_allele_counts_and_numbers = [
        {"AC": 0, "AN": 0} for _ in range(len(populations) + 1)
    ]
    for variant in variants:
        for index_ac, allele_count in enumerate(variant["AC"]):
            allele_number = variant["AN"][index_ac]
            total_allele_counts_and_numbers[index_ac]["AC"] += allele_count
            total_allele_counts_and_numbers[index_ac]["AN"] += allele_number

    carrier_frequency_raw_numbers_array = []
    for ac_an in total_allele_counts_and_numbers:
        carrier_frequency_raw_numbers = {
            "total_ac": ac_an["AC"],
            "average_an": (ac_an["AN"] / variant_count) if variant_count > 0 else 0,
        }
        carrier_frequency_raw_numbers_array.append(carrier_frequency_raw_numbers)

    prevalence_bayesian_array = []
    for q in multiplied_allele_frequencies:
        prevalence_bayesian = (1 - q) ** 2
        prevalence_bayesian_array.append(prevalence_bayesian)

    calculations_object = {
        "variant_count": variant_count,
        "prevalence": prevalence_array,
        "prevalence_bayesian": prevalence_bayesian_array,
        "total_allele_frequency": total_allele_frequencies,
        "carrier_frequency": carrier_frequency_array,
        "carrier_frequency_simplified": carrier_frequency_simplified_array,
        "carrier_frequency_raw_numbers": carrier_frequency_raw_numbers_array,
    }

    return calculations_object
