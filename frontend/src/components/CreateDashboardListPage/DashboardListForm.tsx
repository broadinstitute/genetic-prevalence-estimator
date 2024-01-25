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

import GeneInput from "../CreateVariantListPage/GeneInput";
import TranscriptInput from "../CreateVariantListPage/TranscriptInput";

import { post } from "../../api";
import { renderErrorDescription } from "../../errors";

import { GnomadVersion } from "../../types";

type DashboardListRequest = any;
type DashboardList = any;

const submitDashboardList = (
  request: DashboardListRequest
): Promise<DashboardList> => {
  return post("/dashboard-lists/", request);
};

const DashboardListForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [geneId, setGeneId] = useState("");
  const isGeneIdValid = /^ENSG\d{11}\.\d+$/.test(geneId);
  const [transcriptId, setTranscriptId] = useState("");
  const isTranscriptIdValid = /^ENST\d{11}\.\d+$/.test(transcriptId);

  const [gnomadVersion, setGnomadVersion] = useState("4.0.0");

  const history = useHistory();
  const toast = useToast();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (geneId && isGeneIdValid && transcriptId && isTranscriptIdValid) {
          const dashboardListRequest: DashboardListRequest = {
            label,
            notes,
            metadata: {
              gene_id: geneId,
              transcript_id: transcriptId,
              gnomad_version: gnomadVersion as GnomadVersion,
              include_gnomad_plof: true,
              include_clinvar_clinical_significance: [
                "pathogenic_or_likely_pathogenic",
              ],
            },
          };

          if (!isSubmitting) {
            setIsSubmitting(true);
            submitDashboardList(dashboardListRequest).then(
              (dashboardList) => {
                history.push(`/dashboard-lists/${dashboardList.uuid}/`);
              },
              (error) => {
                setIsSubmitting(false);
                toast({
                  title: "Unable to create dashboard list",
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
          Submit a request for the worker to generate a list algorithmically for
          the dashboard.
        </p>

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
              <Radio value="4.0.0">4.0.0 (GRCh38)</Radio>
              <Radio value="2.1.1">2.1.1 (GRCh37)</Radio>
            </VStack>
          </RadioGroup>

          <FormHelperText>
            <Link
              href="https://gnomad.broadinstitute.org/help/whats-the-difference-between-the-different-versions-of-gnomad"
              isExternal
            >
              What's the difference between gnomAD v2 and v4?
            </Link>
          </FormHelperText>
        </FormControl>

        <GeneInput
          key={`${gnomadVersion}-gene`}
          id="recommended-variant-list-gene-id"
          label="Gene"
          isRequired
          referenceGenome={gnomadVersion.startsWith("2") ? "GRCh37" : "GRCh38"}
          onChange={(selectedGeneSymbol, selectedGeneId) => {
            setGeneId(selectedGeneId);
            setLabel(`${selectedGeneSymbol} - Dashboard`);
            setNotes(
              `This list was algorithmically generated for the gene ${selectedGeneSymbol} with transcript`
            );
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

        <FormControl id="recommended-variant-list-label">
          <FormLabel>Label</FormLabel>
          <Input value={label} variant="filled" isDisabled />
        </FormControl>

        <FormControl id="recommended-variant-list-notes">
          <FormLabel>Notes</FormLabel>
          <Textarea value={notes} variant="filled" isDisabled />
        </FormControl>

        <HStack>
          <Button colorScheme="blue" isLoading={isSubmitting} type="submit">
            Submit
          </Button>
          <Button as={RRLink} to="/dashboard-lists/">
            Cancel
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};

export default DashboardListForm;
