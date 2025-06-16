import argparse
import csv
import os
import pandas as pd
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from datetime import datetime

base_dir = os.path.join(os.path.dirname(__file__), "../data")

# Orphanet XML releases from:  https://github.com/Orphanet/Orphadata_aggregated
XML_PATH = os.path.join(base_dir, "input", "2024-12_orphanet-release_en-product6.xml")

INPUT_GENES_CSV_PATH = os.path.join(
    base_dir, "input", "2025-05-02_genie-dashboard-genelist-ar-and-ad.csv"
)


def get_gene_symbols_from_csv(num_rows=None):
    symbols = []
    with open(INPUT_GENES_CSV_PATH, "r", newline="") as inputCSV:
        csv_reader = csv.reader(inputCSV)
        next(csv_reader)

        for i, row in enumerate(csv_reader):
            if num_rows is not None and i >= num_rows:
                break
            symbols.append(row[0])
    return symbols


def parse_orphanet_xml(gene_symbols_to_keep):
    with open(XML_PATH, "r", encoding="latin-1") as input:
        xml_input = input.read()

    root = ET.fromstring(xml_input)
    disorder_list = root.find("DisorderList")

    gene_info = {}

    for disorder in disorder_list.findall("Disorder"):
        orpha_code = disorder.find("OrphaCode").text
        gene_elements = disorder.findall(".//Gene")
        for gene_element in gene_elements:
            gene_symbol = gene_element.find("Symbol").text
            ensg_id = ""
            external_references = gene_element.findall(".//ExternalReference")
            for ref in external_references:
                if ref.find("Source").text == "Ensembl":
                    ensg_id = ref.find("Reference").text
                    break
            if gene_symbol not in gene_info:
                gene_info[gene_symbol] = {"OrphaCodes": [], "ENSG_ID": ""}
            gene_info[gene_symbol]["OrphaCodes"].append(orpha_code)
            gene_info[gene_symbol]["ENSG_ID"] = ensg_id

    filtered_gene_info = {
        gene_symbol: gene_info[gene_symbol]
        for gene_symbol in gene_symbols_to_keep
        if gene_symbol in gene_info
    }

    return filtered_gene_info


def scrape_orphanet_for_genetic_prevalence(orpha_code):
    url = f"https://www.orpha.net/en/disease/detail/{orpha_code}?name={orpha_code}&mode=orpha"
    response = requests.get(url)
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, "html.parser")
        prevalence_leader_text = soup.find(
            "strong", string=lambda t: "prevalence" in t.lower()
        )
        if prevalence_leader_text:
            prevalence_number = prevalence_leader_text.find_next_sibling("span")
            if prevalence_number:
                return prevalence_number.text.strip()

    return ""


def scrape_orphanet_for_genetic_prevalences(genes_orphacode_dict):
    local_dict = genes_orphacode_dict
    length = len(genes_orphacode_dict)
    i = 1

    for gene_symbol, gene_data in genes_orphacode_dict.items():
        print(f"  - Gene Symbol {gene_symbol} ({i} / {length})")
        orpha_prevalence_array = []

        for orpha_code in gene_data["OrphaCodes"]:
            prevalence = scrape_orphanet_for_genetic_prevalence(orpha_code)
            orpha_prevalence_array.append(f"{orpha_code}:{prevalence}")

        local_dict[gene_symbol]["OrphaPrevalence"] = orpha_prevalence_array
        i += 1

    return local_dict


def convert_to_pandas(filename, dict):
    df = pd.DataFrame.from_dict(dict, orient="index")
    df.to_csv(
        f"./data/processed_data/{filename}",
        mode="w",
        sep="\t",
        index_label="GeneSymbol",
    )
    print(f"\nTSV file saved: {filename}")


def main():
    start_time = datetime.now()

    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", required=False)
    args = parser.parse_args()

    print("\nGetting Orphanet prevalences ...")

    num_genes = None
    output_filename = "orphanet_prevalences.tsv"
    if args.test:
        print("- running with 10 genes as a test")
        num_genes = 10
        output_filename = "test_orphanet_prevalences.tsv"

    csv_genelist = get_gene_symbols_from_csv(num_genes)

    genes_orphacode_dict = parse_orphanet_xml(csv_genelist)

    genes_orphacode_prevalence_dict = scrape_orphanet_for_genetic_prevalences(
        genes_orphacode_dict
    )

    convert_to_pandas(output_filename, genes_orphacode_prevalence_dict)

    end_time = datetime.now()
    print(f"Finished at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"It took: {end_time - start_time}")


if __name__ == "__main__":
    main()
