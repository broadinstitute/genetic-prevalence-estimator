import json
import os

import pandas as pd


# The website's DashboardListsLoadView reads the models CSV by column position.
DASHBOARD_MODEL_COLUMNS = [
    "gene_id",
    "label",
    "notes",
    "date_created",
    "metadata",
    "variant_calculations",
    "top_ten_variants",
    "genetic_prevalence_orphanet",
    "genetic_prevalence_genereviews",
    "genetic_prevalence_other",
    "genetic_incidence_other",
    "type",
]

INDIVIDUAL_GENE_FILE_ANCESTRY_GROUPS = [
    "global",
    "african_african_american",
    "admixed_american",
    "ashkenazi_jewish",
    "east_asian",
    "european_finnish",
    "remaining",
    "south_asian",
]

V4_ANCESTRY_GROUPS = [
    "total",
    "african_african_american",
    "admixed_american",
    "ashkenazi_jewish",
    "east_asian",
    "european_finnish",
    "middle_eastern",
    "european_non_finnish",
    "remaining",
    "south_asian",
]

ANCESTRY_STRATIFIED_DOWNLOAD_FIELDS = [
    {
        "calculations_dict_name": "total_allele_frequency",
        "downloads_column_name": "allele_frequency",
    },
    {
        "calculations_dict_name": "carrier_frequency",
        "downloads_column_name": "carrier_frequency",
    },
    {
        "calculations_dict_name": "prevalence",
        "downloads_column_name": "genetic_prevalence",
    },
]

TOP_TEN_VARIANT_DOWNLOAD_FIELDS = [
    "gnomad_id",
    "vep_consequence",
    "hgvsc",
    "hgvsp",
    "loftee",
    "clinvar_clinical_significance",
    "clinvar_variation_id",
    "allele_count",
    "allele_number",
    "allele_frequency",
    "source",
    "flags",
]

DASHBOARD_DOWNLOAD_COLUMNS = (
    [
        "gene_id",
        "gene_symbol",
        "transcript_id",
        "inheritance_type",
        "gnomad_version",
        "reference_genome",
        "included_clinvar_variants",
        "clinvar_version",
        "date_created",
        "oe_missense_prior",
        "oe_missense_gene",
        "MU_mis",
        "oe_lof_prior",
        "oe_lof_gene",
        "MU_lof",
        "Estimated incidence of de novo variation",
        "Estimated incidence of de novo variation (per 100,000)",
        "# of P, LP and HC pLoF variants in gnomAD",
    ]
    + [
        f"{field['downloads_column_name']}_{ancestry}"
        for field in ANCESTRY_STRATIFIED_DOWNLOAD_FIELDS
        for ancestry in V4_ANCESTRY_GROUPS
    ]
    + [
        f"variant_{i + 1}_{field}"
        for i in range(10)
        for field in TOP_TEN_VARIANT_DOWNLOAD_FIELDS
    ]
)

INHERITANCE_TYPE_NAMES = {
    "AD": "Autosomal dominant",
    "AR": "Autosomal recessive",
    "SD": "Semidominant",
}


def _per_ancestry_values(title, values):
    return {
        f"{title}_{ancestry_group}": values[i]
        for i, ancestry_group in enumerate(INDIVIDUAL_GENE_FILE_ANCESTRY_GROUPS)
    }


def _per_ancestry_allele_frequencies(title, allele_counts, allele_numbers):
    return {
        f"{title}_{ancestry_group}": allele_counts[i] / allele_numbers[i]
        for i, ancestry_group in enumerate(INDIVIDUAL_GENE_FILE_ANCESTRY_GROUPS)
    }


def _individual_gene_file_row(gene_symbol, gene_id, variant):
    return {
        "gene_symbol": gene_symbol,
        "gene_id": gene_id,
        "variant_gnomad_id": variant["id"],
        "vep_consequence": variant["major_consequence"],
        "hgvsc": variant["hgvsc"],
        "hgvsp": variant["hgvsp"],
        "loftee": variant["lof"],
        "clinvar_clinical_significance": variant["clinical_significance"][0]
        if variant["clinical_significance"]
        else None,
        "clinvar_variation_id": variant["clinvar_variation_id"],
        "allele_count": variant["AC"][0] if variant["AC"] else None,
        "allele_number": variant["AN"][0] if variant["AN"] else None,
        "allele_frequency": (variant["AC"][0] / variant["AN"][0])
        if (variant["AC"] and variant["AN"])
        else None,
        "homozygote_count": variant["homozygote_count"][0]
        if variant["homozygote_count"]
        else None,
        "flags": "|".join(variant["flags"]),
        "source": "|".join(variant["source"]),
        "allele_count_per_ancestry": _per_ancestry_values("allele_count", variant["AC"])
        if variant["AC"]
        else None,
        "allele_number_per_ancestry": _per_ancestry_values(
            "allele_number", variant["AN"]
        )
        if variant["AN"]
        else None,
        "allele_frequency_per_ancestry": _per_ancestry_allele_frequencies(
            "allele_frequency", variant["AC"], variant["AN"]
        )
        if (variant["AC"] and variant["AN"])
        else None,
        "homozygote_count_per_ancestry": _per_ancestry_values(
            "homozygote_count", variant["homozygote_count"]
        )
        if variant["homozygote_count"]
        else None,
    }


def write_recommended_variants_to_csv(
    base_dir, gene_symbol, gene_id, recommended_variants
):
    df = pd.DataFrame(
        [
            _individual_gene_file_row(gene_symbol, gene_id, variant)
            for variant in recommended_variants
        ]
    )

    filename = f"GeniE_dashboard_variants-{gene_symbol}-{gene_id}.csv"
    output_dir = os.path.join(
        base_dir,
        "output",
        "dashboard",
        "individual_gene_files",
    )
    full_output_path = os.path.join(output_dir, filename)

    os.makedirs(output_dir, exist_ok=True)
    df.to_csv(full_output_path, index=False)
    print(f"    - Gene-variant CSV file written to ...{filename}")


def serialize_dashboard_models(models):
    models = models.copy()
    for column in ("metadata", "variant_calculations", "top_ten_variants"):
        models[column] = models[column].map(json.dumps)

    return models[DASHBOARD_MODEL_COLUMNS]


def _expand_inheritance_abbreviations(inheritance_type_abbreviations):
    return ", ".join(
        INHERITANCE_TYPE_NAMES.get(abbreviation.strip(), "")
        for abbreviation in inheritance_type_abbreviations.split(",")
    )


def _ancestry_stratified_download_values(calculations):
    result = {}
    for field in ANCESTRY_STRATIFIED_DOWNLOAD_FIELDS:
        values = calculations.get(
            field["calculations_dict_name"], [0] * len(V4_ANCESTRY_GROUPS)
        )
        for i, ancestry in enumerate(V4_ANCESTRY_GROUPS):
            result[f"{field['downloads_column_name']}_{ancestry}"] = values[i]
    return result


def _top_ten_variant_download_values(top_ten_variants):
    top_ten_variant_data = {}

    for i, variant in enumerate(top_ten_variants):
        prefix = f"variant_{i + 1}"
        allele_count = variant["AC"][0]
        allele_number = variant["AN"][0]

        top_ten_variant_data.update(
            {
                f"{prefix}_gnomad_id": variant["id"],
                f"{prefix}_vep_consequence": variant["major_consequence"],
                f"{prefix}_hgvsc": variant["hgvsc"],
                f"{prefix}_hgvsp": variant["hgvsp"],
                f"{prefix}_loftee": variant["lof"],
                f"{prefix}_clinvar_clinical_significance": (
                    variant["clinical_significance"][0]
                    if variant["clinical_significance"]
                    else None
                ),
                f"{prefix}_clinvar_variation_id": variant["clinvar_variation_id"],
                f"{prefix}_allele_count": int(allele_count),
                f"{prefix}_allele_number": int(allele_number),
                f"{prefix}_allele_frequency": (
                    0
                    if allele_count == 0
                    else "{:.2e}".format(allele_count / allele_number)
                ),
                f"{prefix}_source": ", ".join(variant["source"]),
                f"{prefix}_flags": ", ".join(variant["flags"]),
            }
        )

    return top_ten_variant_data


def _dashboard_download_row(gene_result):
    metadata = gene_result["metadata"]
    calculations = gene_result["variant_calculations"]

    row_data = {
        "gene_id": gene_result.get("gene_id"),
        "gene_symbol": metadata["gene_symbol"],
        "transcript_id": metadata["transcript_id"],
        "gnomad_version": metadata["gnomad_version"],
        "reference_genome": metadata["reference_genome"],
        "# of P, LP and HC pLoF variants in gnomAD": calculations.get("variant_count"),
        "included_clinvar_variants": ", ".join(
            metadata.get("include_clinvar_clinical_significance", [])
        ),
        "clinvar_version": metadata.get("clinvar_version", ""),
        "date_created": gene_result["date_created"],
        "inheritance_type": _expand_inheritance_abbreviations(gene_result["type"]),
    }

    row_data.update(_ancestry_stratified_download_values(calculations))
    row_data.update(_top_ten_variant_download_values(gene_result["top_ten_variants"]))
    return row_data


def prepare_dashboard_download(gene_results):
    df_download = pd.DataFrame(
        [
            _dashboard_download_row(gene_result)
            for _, gene_result in gene_results.iterrows()
        ]
    )

    for col in DASHBOARD_DOWNLOAD_COLUMNS:
        if col not in df_download.columns:
            df_download[col] = None

    return df_download[DASHBOARD_DOWNLOAD_COLUMNS]
