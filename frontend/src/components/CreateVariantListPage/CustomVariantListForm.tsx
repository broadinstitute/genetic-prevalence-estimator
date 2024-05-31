import {
  Button,
  Checkbox,
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
  Text,
  Box,
} from "@chakra-ui/react";
import { isVariantId, normalizeVariantId } from "@gnomad/identifiers";
import { useState } from "react";
import { Link as RRLink, useHistory } from "react-router-dom";

import { post } from "../../api";
import { renderErrorDescription } from "../../errors";
import {
  GnomadVersion,
  VariantList,
  VariantListRequest,
  VariantListType,
} from "../../types";
import HelpTextHover from "../HelpTextHover";
import { isStructuralVariantId } from "../identifiers";
import VariantsInput, { InputVariant } from "../VariantsInput";
import GeneInput from "./GeneInput";
import TranscriptInput from "./TranscriptInput";

const submitVariantList = (
  request: VariantListRequest
): Promise<VariantList> => {
  return post("/variant-lists/", request);
};

const CustomVariantListForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [gnomadVersion, setGnomadVersion] = useState("4.1.0");
  const [selectTranscript, setSelectTranscript] = useState(false);
  const [geneId, setGeneId] = useState("");
  const [geneSymbol, setGeneSymbol] = useState("");
  const isGeneIdValid = /^ENSG\d{11}\.\d+$/.test(geneId);
  const [transcriptId, setTranscriptId] = useState("");
  const isTranscriptIdValid = /^ENST\d{11}\.\d+$/.test(transcriptId);
  const [variants, setVariants] = useState<InputVariant[]>([]);

  const history = useHistory();
  const toast = useToast();

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();

          const invalid = variants.some(({ id }) => {
            if (!isVariantId(id) && !isStructuralVariantId(id, gnomadVersion)) {
              toast({
                title: "Invalid variant ID",
                description: `Variant with id: ${id} is not recognized as either a short variant or structural variant ID`,
                status: "error",
                duration: 3_000,
                isClosable: true,
              });
              return true;
            }
            return false;
          });

          // if there are any malformed variants, don't allow submission
          if (invalid) {
            return;
          }

          if (
            (selectTranscript && !transcriptId) ||
            (geneId && !isGeneIdValid) ||
            (transcriptId && !isTranscriptIdValid)
          ) {
            return;
          }

          const variantListRequest: VariantListRequest = {
            label,
            notes,
            type: VariantListType.CUSTOM,
            metadata: {
              gnomad_version: gnomadVersion as GnomadVersion,
            },
            variants: variants
              .filter(({ id }) => isVariantId(id))
              .map(({ id }) => ({
                id: normalizeVariantId(id),
              })),
            structural_variants: variants
              .filter(({ id }) => isStructuralVariantId(id, gnomadVersion))
              .map(({ id }) => ({
                id,
              })),
          };

          if (selectTranscript) {
            variantListRequest.metadata.gene_id = geneId;
            variantListRequest.metadata.gene_symbol = geneSymbol;
            variantListRequest.metadata.transcript_id = transcriptId;
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
                  description: renderErrorDescription(error),
                  status: "error",
                  duration: 10000,
                  isClosable: true,
                });
              }
            );
          }
        }}
      >
        <VStack spacing={4} align="flex-start">
          <Text>
            Custom variant lists include any variants with a gnomAD ID that are
            provided by the user. These can either be entered manually or
            uploaded in a list in either a .tsv, .csv, or .txt format.{" "}
            <Text mt={4}>
              <em>
                Please use caution including a list of variants from multiple
                genes, as this will assume digenic inheritance is possible. For
                more information on how to us GeniE for multiple genes please
                see our <Link href="/faq">FAQ</Link>.
              </em>
            </Text>
          </Text>
          <FormControl id="custom-variant-list-label" isRequired>
            <Box display="flex">
              <FormLabel>Label</FormLabel>
              <HelpTextHover helpText="This is the name of your variant list that will be displayed on your home page. If you share your variant list with others this will be the name displayed on their home page as well." />
            </Box>
            <Input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
              }}
            />
          </FormControl>

          <FormControl id="custom-variant-list-notes">
            <FormLabel>Notes</FormLabel>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
            />
          </FormControl>

          <FormControl id="custom-variant-list-gnomad-version" isRequired>
            <FormLabel>gnomAD version</FormLabel>
            <RadioGroup value={gnomadVersion} onChange={setGnomadVersion}>
              <VStack align="flex-start">
                <Radio value="4.1.0">4.1.0 (GRCh38)</Radio>
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

          <FormControl>
            <Checkbox
              checked={selectTranscript}
              onChange={(e) => {
                const checked = e.target.checked;
                setSelectTranscript(checked);
                if (!checked) {
                  setGeneId("");
                  setGeneSymbol("");
                  setTranscriptId("");
                }
              }}
            >
              Select transcript
            </Checkbox>
            <FormHelperText>
              If a transcript is selected, the variant list will show variants'
              consequences in that transcript. If no transcript is selected, the
              variant list will show variants' most severe consequence in any
              transcript.
            </FormHelperText>
          </FormControl>

          {selectTranscript && (
            <>
              <GeneInput
                key={`${gnomadVersion}-gene`}
                id="custom-variant-list-gene-id"
                label="Gene"
                helpText={
                  <span>
                    Gene names are based on gnomAD, which uses GENCODE/VEP to
                    annotate gene names. Gene names are usually HGNC but there
                    are some exceptions. To find out more information about how
                    gencode selects gene names go to{" "}
                    <Link
                      href="https://www.gencodegenes.org/pages/faq.html"
                      isExternal
                    >
                      https://www.gencodegenes.org/pages/faq.html
                    </Link>
                  </span>
                }
                referenceGenome={
                  gnomadVersion.startsWith("2") ? "GRCh37" : "GRCh38"
                }
                onChange={(selectedGeneSymbol, selectedGeneId) => {
                  setGeneSymbol(selectedGeneSymbol);
                  setGeneId(selectedGeneId);
                  if (selectedGeneId !== geneId) {
                    setTranscriptId("");
                  }
                }}
              />

              <TranscriptInput
                key={`${gnomadVersion}-transcript`}
                id="custom-variant-list-transcript-id"
                label="Transcript"
                helpText={
                  <span>
                    GeniE defaults to the MANE (GRCh38)/canonical (GRCh37/hg19)
                    transcript of the gene. You can also select other
                    transcripts from the drop down. Additional support,
                    including visualizing various transcripts and pext scores,
                    can be found on the{" "}
                    <Link
                      href={`https://gnomad.broadinstitute.org/gene/${
                        geneId.split(".")[0]
                      }?dataset=${
                        gnomadVersion.startsWith("2")
                          ? "gnomad_r2_1"
                          : "gnomad_r4"
                      }`}
                      isExternal
                    >
                      gnomAD gene page
                    </Link>
                    .
                  </span>
                }
                geneId={geneId}
                referenceGenome={
                  gnomadVersion.startsWith("2") ? "GRCh37" : "GRCh38"
                }
                value={transcriptId}
                onChange={setTranscriptId}
              />
            </>
          )}

          <VariantsInput
            id="custom-variant-list-variants"
            gnomadVersion={gnomadVersion}
            value={variants}
            onChange={setVariants}
          />

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
    </>
  );
};

export default CustomVariantListForm;
