import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Link,
  Radio,
  RadioGroup,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { post } from "../../api";
import { renderErrorDescription } from "../../errors";
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

  const [gnomadVersion, setGnomadVersion] = useState("2.1.1");

  const [includedClinvarVariants, setIncludedClinvarVariants] = useState<
    ClinvarClinicalSignificanceCategory[]
  >(["pathogenic_or_likely_pathogenic"]);

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
              included_clinvar_variants: includedClinvarVariants,
            },
          };

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
                  description: renderErrorDescription(error),
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
        <p>
          Recommended variant lists include variants from gnomAD that occur in
          the selected transcript and are predicted loss-of-function with high
          confidence. Optionally, they may include additional variants based on
          their clinical significance in ClinVar.
        </p>

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

        <FormControl id="recommended-variant-list-gnomad-version" isRequired>
          <FormLabel>gnomAD version</FormLabel>
          <RadioGroup
            value={gnomadVersion}
            onChange={(selectedGnomadVersion) => {
              setGnomadVersion(selectedGnomadVersion);
              setGeneId("");
              setTranscriptId("");
            }}
          >
            <VStack align="flex-start">
              <Radio value="2.1.1">2.1.1 (GRCh37)</Radio>
              <Radio value="3.1.2">3.1.2 (GRCh38)</Radio>
            </VStack>
          </RadioGroup>

          <FormHelperText>
            <Link
              href="https://gnomad.broadinstitute.org/help/whats-the-difference-between-gnomad-v2-and-v3"
              isExternal
            >
              What's the difference between gnomAD v2 and v3?
            </Link>
          </FormHelperText>
        </FormControl>

        <GeneInput
          key={`${gnomadVersion}-gene`}
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
          key={`${gnomadVersion}-transcript`}
          id="recommended-variant-list-transcript-id"
          label="Transcript"
          isRequired
          geneId={geneId}
          referenceGenome={gnomadVersion.startsWith("2") ? "GRCh37" : "GRCh38"}
          value={transcriptId}
          onChange={setTranscriptId}
        />

        <FormControl
          id="recommended-variant-list-included-clinvar-variants"
          isRequired
        >
          <FormLabel>
            Include variants based on clinical significance in ClinVar?
          </FormLabel>
          <RadioGroup
            value={includedClinvarVariants.join("|")}
            onChange={(value) => {
              setIncludedClinvarVariants(
                value
                  .split("|")
                  .filter(Boolean) as ClinvarClinicalSignificanceCategory[]
              );
            }}
          >
            <VStack align="flex-start">
              <Radio value="pathogenic_or_likely_pathogenic">
                Include pathogenic and likely pathogenic variants
              </Radio>
              <Radio value="pathogenic_or_likely_pathogenic|conflicting_interpretations">
                Include pathogenic and likely pathogenic variants and variants
                with conflicting interpretations of pathogenicity
              </Radio>
              <Radio value="">
                Do not include variants based on clinical significance
              </Radio>
            </VStack>
          </RadioGroup>
        </FormControl>

        <HStack>
          <Button colorScheme="blue" isLoading={isSubmitting} type="submit">
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
