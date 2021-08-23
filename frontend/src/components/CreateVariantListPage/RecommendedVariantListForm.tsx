import {
  Button,
  FormControl,
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
  ClinvarClinicalSignificanceCategory,
  RecommendedVariantListRequest,
  RecommendedVariantList,
  GnomadVersion,
  VariantListType,
} from "../../types";
import GeneInput from "./GeneInput";
import TranscriptInput from "./TranscriptInput";

const submitVariantList = (
  request: RecommendedVariantListRequest
): Promise<RecommendedVariantList> => {
  return post("/variant-lists/", request);
};

const RecommendedVariantListForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [geneId, setGeneId] = useState("");
  const isGeneIdValid = /^ENSG\d{11}\.\d+$/.test(geneId);
  const [transcriptId, setTranscriptId] = useState("");
  const isTranscriptIdValid = /^ENST\d{11}\.\d+$/.test(transcriptId);

  const [gnomadVersion, setGnomadVersion] = useState("3.1.1");

  const [includedClinvarVariants, setIncludedClinvarVariants] = useState(
    "pathogenic_or_likely_pathogenic"
  );

  const history = useHistory();
  const toast = useToast();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (geneId && isGeneIdValid && transcriptId && isTranscriptIdValid) {
          const variantListRequest: RecommendedVariantListRequest = {
            label,
            notes,
            type: VariantListType.RECOMMENDED,
            metadata: {
              version: "1",
              gene_id: geneId,
              transcript_id: transcriptId,
              gnomad_version: gnomadVersion as GnomadVersion,
              included_clinvar_variants: null,
            },
          };

          if (includedClinvarVariants !== "none") {
            variantListRequest.metadata.included_clinvar_variants = includedClinvarVariants.split(
              "|"
            ) as ClinvarClinicalSignificanceCategory[];
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
        <FormControl id="recommended-variant-list-label" isRequired>
          <FormLabel>Label</FormLabel>
          <Input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
            }}
          />
        </FormControl>

        <FormControl id="recommended-variant-list-notes">
          <FormLabel>Notes</FormLabel>
          <Textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
          />
        </FormControl>

        <GeneInput
          id="recommended-variant-list-gene-id"
          label="Gene"
          isRequired
          referenceGenome={gnomadVersion.startsWith("2") ? "GRCh37" : "GRCh38"}
          onChange={(selectedGeneId) => {
            setGeneId(selectedGeneId);
            if (selectedGeneId !== geneId) {
              setTranscriptId("");
            }
          }}
        />

        <TranscriptInput
          id="recommended-variant-list-transcript-id"
          label="Transcript"
          isRequired
          geneId={geneId}
          referenceGenome={gnomadVersion.startsWith("2") ? "GRCh37" : "GRCh38"}
          value={transcriptId}
          onChange={setTranscriptId}
        />

        <FormControl id="recommended-variant-list-gnomad-version" isRequired>
          <FormLabel>gnomAD version</FormLabel>
          <RadioGroup value={gnomadVersion} onChange={setGnomadVersion}>
            <VStack align="flex-start">
              <Radio value="3.1.1">3.1.1 (GRCh38)</Radio>
              <Radio value="2.1.1">2.1.1 (GRCh37)</Radio>
            </VStack>
          </RadioGroup>
        </FormControl>

        <FormControl
          id="recommended-variant-list-included-clinvar-variants"
          isRequired
        >
          <FormLabel>Include ClinVar variants</FormLabel>
          <RadioGroup
            value={includedClinvarVariants}
            onChange={setIncludedClinvarVariants}
          >
            <VStack align="flex-start">
              <Radio value="pathogenic_or_likely_pathogenic">
                Pathogenic / likely pathogenic
              </Radio>
              <Radio value="pathogenic_or_likely_pathogenic|conflicting_interpretations">
                Pathogenic / likely pathogenic, Conflicting interpretations of
                pathogenicity
              </Radio>
              <Radio value="none">None</Radio>
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

export default RecommendedVariantListForm;
