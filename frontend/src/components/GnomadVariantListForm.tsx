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

import { post } from "../api";
import {
  GnomadVariantListRequest,
  GnomadVariantList,
  GnomadVersion,
} from "../types";

const submitVariantList = (
  request: GnomadVariantListRequest
): Promise<GnomadVariantList> => {
  return post("/variant-lists/", request).then(
    (response) => response.variant_list
  );
};

const GnomadVariantListForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [geneId, setGeneId] = useState("");
  const isGeneIdValid = /^ENSG\d{11}$/.test(geneId);

  const [gnomadVersion, setGnomadVersion] = useState("2");

  const [lofteeFilter, setLofteeFilter] = useState("HC");
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
            description,
            type: "gnomad",
            metadata: {
              version: "1",
              gene_id: geneId,
              gnomad_version: gnomadVersion as GnomadVersion,
              filter_loftee: null,
              filter_clinvar_clinical_significance: null,
            },
          };

          if (lofteeFilter === "HC") {
            variantListRequest.metadata.filter_loftee = ["HC"];
          } else if (lofteeFilter === "HC+LC") {
            variantListRequest.metadata.filter_loftee = ["HC", "LC"];
          }

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

        <FormControl id="gnomad-variant-list-description">
          <FormLabel>Description</FormLabel>
          <Textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
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

        <FormControl id="gnomad-variant-list-gnomad-version" isRequired>
          <FormLabel>gnomAD version</FormLabel>
          <RadioGroup value={gnomadVersion} onChange={setGnomadVersion}>
            <VStack align="flex-start">
              <Radio value="2">2.1.1 (GRCh37)</Radio>
              <Radio value="3">3.1.1 (GRCh38)</Radio>
            </VStack>
          </RadioGroup>
        </FormControl>

        <FormControl id="gnomad-variant-list-loftee" isRequired>
          <FormLabel>LOFTEE</FormLabel>
          <RadioGroup value={lofteeFilter} onChange={setLofteeFilter}>
            <VStack align="flex-start">
              <Radio value="HC">High-confidence only</Radio>
              <Radio value="HC+LC">High-confidence and low-confidence</Radio>
              <Radio value="none">Any</Radio>
            </VStack>
          </RadioGroup>
        </FormControl>

        <FormControl id="gnomad-variant-list-loftee" isRequired>
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
