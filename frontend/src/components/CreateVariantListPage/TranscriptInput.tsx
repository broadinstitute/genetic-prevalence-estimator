import { FormControl, FormLabel, Select } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

import CancelablePromise from "../../CancelablePromise";
import { ReferenceGenome } from "../../types";

const fetchTranscripts = (geneId: string, referenceGenome: ReferenceGenome) => {
  return fetch("https://gnomad.broadinstitute.org/api/", {
    body: JSON.stringify({
      query: `
        query GeneTranscript($geneId: String!, $referenceGenome: ReferenceGenomeId!) {
          gene(gene_id: $geneId, reference_genome: $referenceGenome) {
            transcripts {
              transcript_id
              transcript_version
            }
          }
        }
      `,
      variables: { geneId, referenceGenome },
    }),
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then((response) => response.json())
    .then((response) => {
      if (!response.data.gene) {
        throw new Error("Unable to retrieve transcripts");
      }

      return response.data.gene.transcripts;
    });
};

interface TranscriptInputProps {
  id: string;
  label: string;
  geneId: string;
  referenceGenome: ReferenceGenome;
  isRequired?: boolean;
  value: string;
  onChange: (value: string) => void;
}

type Transcript = {
  transcript_id: string;
  transcript_version: string;
};

const TranscriptInput = (props: TranscriptInputProps) => {
  const {
    id,
    label,
    geneId,
    referenceGenome,
    isRequired = false,
    value,
    onChange,
  } = props;

  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  const activeRequest = useRef<CancelablePromise<Transcript[]> | null>(null);
  useEffect(() => {
    if (activeRequest.current) {
      activeRequest.current.cancel();
    }

    if (geneId) {
      activeRequest.current = new CancelablePromise((resolve, reject) => {
        fetchTranscripts(geneId, referenceGenome).then(resolve, reject);
      });

      activeRequest.current.then((fetchedTranscripts) => {
        setTranscripts(fetchedTranscripts);
        onChange(fetchedTranscripts[0].transcript_id);
      });
    } else {
      activeRequest.current = null;
      setTranscripts([]);
    }
  }, [geneId, referenceGenome, onChange]);

  return (
    <FormControl id={id} isRequired={isRequired}>
      <FormLabel>{label}</FormLabel>
      <Select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {transcripts.map((transcript) => (
          <option
            key={transcript.transcript_id}
            value={transcript.transcript_id}
          >
            {transcript.transcript_id}.{transcript.transcript_version}
          </option>
        ))}
      </Select>
    </FormControl>
  );
};

export default TranscriptInput;
