import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { post } from "../../api";
import {
  GnomadVariantListRequest,
  GnomadVariantList,
  GnomadVersion,
} from "../../types";

const submitVariantList = (
  request: GnomadVariantListRequest
): Promise<GnomadVariantList> => {
  return post("/variant-lists/", request);
};

const GnomadVariantListForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [geneId, setGeneId] = useState("");
  const isGeneIdValid = /^ENSG\d{11}$/.test(geneId);
  const [transcriptId, setTranscriptId] = useState("");
  const isTranscriptIdValid = /^ENST\d{11}$/.test(transcriptId);

  const [gnomadVersion, setGnomadVersion] = useState("2.1.1");

  const [clinvarFilter, setClinvarFilter] = useState("pathogenic");

  const history = useHistory();
  const toast = useToast();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (geneId && isGeneIdValid) {
          const variantListRequest: GnomadVariantListRequest = {
            label,
            notes,
            type: "gnomad",
            metadata: {
              version: "1",
              gene_id: geneId,
              transcript_id: transcriptId,
              gnomad_version: gnomadVersion as GnomadVersion,
              filter_clinvar_clinical_significance: null,
            },
          };

          if (clinvarFilter === "pathogenic") {
            variantListRequest.metadata.filter_clinvar_clinical_significance = [
              "pathogenic",
            ];
          } else if (clinvarFilter === "pathogenic+uncertain") {
            variantListRequest.metadata.filter_clinvar_clinical_significance = [
              "pathogenic",
              "uncertain",
            ];
          }

          if (!isSubmitting) {
            setIsSubmitting(true);
            submitVariantList(variantListRequest).then(
              (variantList) => {
                history.push(`/variant-lists/${variantList.uuid}/`);
              },
              (error) => {
                setIsSubmitting(false);
                toast({
                  title: "Unable to create variant list",
                  description: error.message,
                  status: "error",
                  duration: 10000,
                  isClosable: true,
                });
              }
            );
          }
        }
      }}
    >
      <VStack spacing={4} align="flex-start">
        <FormControl id="gnomad-variant-list-label" isRequired>
          <FormLabel>Label</FormLabel>
          <Input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
            }}
          />
        </FormControl>

        <FormControl id="gnomad-variant-list-notes">
          <FormLabel>Notes</FormLabel>
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
          />
        </FormControl>

        <FormControl
          id="gnomad-variant-list-gene-id"
          isInvalid={!!geneId && !isGeneIdValid}
          isRequired
        >
          <FormLabel>Ensembl Gene ID</FormLabel>
          <Input
            placeholder="ENSG00000169174"
            value={geneId}
            onChange={(e) => {
              setGeneId(e.target.value);
            }}
          />
          <FormErrorMessage>An Ensembl gene ID is required.</FormErrorMessage>
        </FormControl>

        <FormControl
          id="gnomad-variant-list-transcript-id"
          isInvalid={!!transcriptId && !isTranscriptIdValid}
          isRequired
        >
          <FormLabel>Ensembl Transcript ID</FormLabel>
          <Input
            placeholder="ENST00000302118"
            value={transcriptId}
            onChange={(e) => {
              setTranscriptId(e.target.value);
            }}
          />
          <FormErrorMessage>
            An Ensembl transcript ID is required.
          </FormErrorMessage>
        </FormControl>

        <FormControl id="gnomad-variant-list-gnomad-version" isRequired>
          <FormLabel>gnomAD version</FormLabel>
          <RadioGroup value={gnomadVersion} onChange={setGnomadVersion}>
            <VStack align="flex-start">
              <Radio value="2.1.1">2.1.1 (GRCh37)</Radio>
              <Radio value="3.1.1">3.1.1 (GRCh38)</Radio>
            </VStack>
          </RadioGroup>
        </FormControl>

        <FormControl id="gnomad-variant-list-clinical-significance" isRequired>
          <FormLabel>ClinVar clinical significance</FormLabel>
          <RadioGroup value={clinvarFilter} onChange={setClinvarFilter}>
            <VStack align="flex-start">
              <Radio value="pathogenic">Pathogenic only</Radio>
              <Radio value="pathogenic+uncertain">
                Pathogenic and uncertain
              </Radio>
              <Radio value="none">Any</Radio>
            </VStack>
          </RadioGroup>
        </FormControl>

        <HStack>
          <Button colorScheme="blue" type="submit">
            Submit
          </Button>
          <Button as={RRLink} to="/variant-lists/">
            Cancel
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};

export default GnomadVariantListForm;
