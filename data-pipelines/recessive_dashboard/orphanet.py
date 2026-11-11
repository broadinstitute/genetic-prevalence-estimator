import ast

import pandas as pd


def _format_orphanet_prevalence(prevalence):
    parts = prevalence.split("/")
    numerator = parts[0].strip()
    denominator = parts[1].strip()
    formatted_denominator = "{:,}".format(
        int(denominator.replace(" ", "").replace(",", ""))
    )
    return f"{numerator} / {formatted_denominator}"


def _orphanet_prevalence_for_gene(orpha_prevalence_cell):
    prevalences = [
        prevalence.split(":")[1]
        for prevalence in ast.literal_eval(orpha_prevalence_cell)
    ]
    prevalences = [
        "-" if prevalence == "Unknown" else prevalence for prevalence in prevalences
    ]
    if all(value == prevalences[0] for value in prevalences):
        if "/" in prevalences[0]:
            return _format_orphanet_prevalence(prevalences[0])
        return prevalences[0]
    else:
        return "multiple_prevalences"


def annotate_gene_results_with_orphanet_prevalences(gene_results, orphanet):
    orphanet["genetic_prevalence_orphanet"] = orphanet["OrphaPrevalence"].apply(
        _orphanet_prevalence_for_gene
    )

    orphanet = orphanet.rename(columns={"ENSG_ID": "gene_id"}).drop(
        columns=["OrphaCodes", "OrphaPrevalence", "GeneSymbol"]
    )

    pd.set_option("display.max_columns", None)
    return pd.merge(gene_results, orphanet, on="gene_id", how="left")
