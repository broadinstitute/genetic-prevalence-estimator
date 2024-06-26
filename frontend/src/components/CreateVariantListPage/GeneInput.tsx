import { useCallback } from "react";

import { ReferenceGenome } from "../../types";
import Combobox from "../Combobox";

interface GeneInputProps {
  id: string;
  label: string;
  helpText?: any;
  isRequired?: boolean;
  referenceGenome: ReferenceGenome;
  onChange: (geneSymbol: string, geneId: string) => void;
}

type GeneSearchResult = {
  ensembl_id: string;
  ensembl_version: string;
  symbol: string;
};

const fetchGenes = (query: string, referenceGenome: ReferenceGenome) => {
  return fetch("https://gnomad.broadinstitute.org/api/", {
    body: JSON.stringify({
      query: `
        query GeneSearch($query: String!, $referenceGenome: ReferenceGenomeId!) {
          gene_search(query: $query, reference_genome: $referenceGenome) {
            ensembl_id
            ensembl_version
            symbol
          }
        }
      `,
      variables: { query, referenceGenome },
    }),
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then((response) => response.json())
    .then((response) => {
      if (!response.data.gene_search) {
        throw new Error("Unable to retrieve search results");
      }

      return response.data.gene_search;
    });
};

const GeneInput = (props: GeneInputProps) => {
  const { id, label, helpText, isRequired, referenceGenome, onChange } = props;

  const fetchItems = useCallback(
    (inputValue) => fetchGenes(inputValue, referenceGenome),
    [referenceGenome]
  );

  return (
    <Combobox<GeneSearchResult>
      id={id}
      label={label}
      helpText={helpText || undefined}
      placeholder="PCSK9"
      isRequired={isRequired}
      fetchItems={fetchItems}
      itemToString={(result) =>
        `${result.symbol} (${result.ensembl_id}.${result.ensembl_version})`
      }
      onSelectItem={(result) =>
        onChange(
          `${result.symbol}`,
          `${result.ensembl_id}.${result.ensembl_version}`
        )
      }
    />
  );
};

export default GeneInput;
