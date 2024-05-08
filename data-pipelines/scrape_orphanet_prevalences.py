import csv
import os
import pandas as pd
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from datetime import datetime

current_dir = os.getcwd()
XML_PATH = os.path.join(current_dir, "../data/input/en_product6.xml")
INPUT_GENES_CSV_PATH = os.path.join(
    current_dir, "../data/input/20240506_genie_genes_input.csv"
)


def getListOfGenesToKeep():
    with open(INPUT_GENES_CSV_PATH, "r", newline="") as inputCSV:
        csv_reader = csv.reader(inputCSV)
        next(csv_reader)
        symbols = [row[0] for row in csv_reader]
    return symbols


def parseXML(gene_symbols_to_keep):
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


def scrape_orphanet(orpha_code):
    url = f"https://www.orpha.net/en/disease/detail/{orpha_code}?name={orpha_code}&mode=orpha"
    response = requests.get(url)
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, "html.parser")
        prevalence_leader_text = soup.find(
            "strong", text=lambda t: "prevalence" in t.lower()
        )
        if prevalence_leader_text:
            prevalence_number = prevalence_leader_text.find_next_sibling("span")
            if prevalence_number:
                return prevalence_number.text.strip()

    return ""


def get_genetic_prevalences(genes_orphacode_dict):
    local_dict = genes_orphacode_dict
    length = len(genes_orphacode_dict)
    i = 1

    for gene_symbol, gene_data in genes_orphacode_dict.items():
        print(f"\nRunning, {i} / {length}")
        print(f"  Gene Symbol: {gene_symbol}")
        orpha_prevalence_array = []

        for orpha_code in gene_data["OrphaCodes"]:
            prevalence = scrape_orphanet(orpha_code)
            orpha_prevalence_array.append(f"{orpha_code}:{prevalence}")

        local_dict[gene_symbol]["OrphaPrevalence"] = orpha_prevalence_array
        i += 1

    return local_dict


def convert_to_pandas(dict):
    df = pd.DataFrame.from_dict(dict, orient="index")
    filename = "orphanet_prevalences.tsv"
    df.to_csv(f"./data/{filename}", mode="w", sep="\t", index_label="GeneSymbol")
    print(f"\nTSV file saved: {filename}")


def print_time(message):
    now = datetime.now()
    formatted_time = now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-2]
    print(f"{message}: {formatted_time}")


def main():
    print_time("Getting Orphanet prevalences ...")
    list_of_genes_to_keep = getListOfGenesToKeep()
    genes_orphacode_dict = parseXML(list_of_genes_to_keep)
    genes_orphacode_prevalence_dict = get_genetic_prevalences(genes_orphacode_dict)
    convert_to_pandas(genes_orphacode_prevalence_dict)
    print_time("Finished getting Orphanet prevalences!")


main()
