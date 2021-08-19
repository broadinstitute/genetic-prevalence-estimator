import { FormControl, FormLabel, Select } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

import CancelablePromise from "../../CancelablePromise";
import { ReferenceGenome } from "../../types";

type Transcript = {
  transcript_id: string;
  transcript_version: string;
};

const fetchTranscripts = (geneId: string, referenceGenome: ReferenceGenome) => {
  return fetch("https://gnomad.broadinstitute.org/api/", {
    body: JSON.stringify({
      query: `
        query GeneTranscript($geneId: String!, $referenceGenome: ReferenceGenomeId!) {
          gene(gene_id: $geneId, reference_genome: $referenceGenome) {
            canonical_transcript_id
            mane_select_transcript {
              ensembl_id
              ensembl_version
            }
            transcripts {
              transcript_id
              transcript_version
            }
          }
        }
      `,
      variables: {
        geneId: geneId.split(".")[0],
        referenceGenome,
      },
    }),
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then((response) => response.json())
    .then((response) => {
      if (!response.data.gene) {
        throw new Error("Unable to retrieve transcripts");
      }

      const gene = response.data.gene;

      const preferredTranscripts: string[] = [];
      if (gene.mane_select_transcript) {
        preferredTranscripts.push(gene.mane_select_transcript.ensembl_id);
      }
      if (gene.canonical_transcript_id) {
        preferredTranscripts.push(gene.canonical_transcript_id);
      }

      return gene.transcripts.sort((t1: Transcript, t2: Transcript) => {
        const t1PreferredIndex = preferredTranscripts.indexOf(t1.transcript_id);
        const t2PreferredIndex = preferredTranscripts.indexOf(t2.transcript_id);

        if (t1PreferredIndex === -1 && t2PreferredIndex === -1) {
          return t1.transcript_id.localeCompare(t2.transcript_id);
        }
        if (t1PreferredIndex !== -1 && t2PreferredIndex === -1) {
          return -1;
        }
        if (t1PreferredIndex === -1 && t2PreferredIndex !== -1) {
          return 1;
        }
        return t1PreferredIndex - t2PreferredIndex;
      });
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
        const defaultTranscript = fetchedTranscripts[0];
        onChange(
          `${defaultTranscript.transcript_id}.${defaultTranscript.transcript_version}`
        );
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
            value={`${transcript.transcript_id}.${transcript.transcript_version}`}
          >
            {transcript.transcript_id}.{transcript.transcript_version}
          </option>
        ))}
      </Select>
    </FormControl>
  );
};

export default TranscriptInput;
