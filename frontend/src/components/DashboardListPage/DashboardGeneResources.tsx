import {
  Box,
  Button,
  Heading,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { ReactNode } from "react";

import { renderFrequencyFraction } from "../VariantListPage/VariantListCalculations/calculationsDisplayFormats";

interface DashboardGeneResourceData {
  readonly gene_id: string;
  readonly gene_symbol: string;
  readonly inheritance_type: string;
  readonly estimated_genetic_prevalence?: number | null;
  readonly estimated_de_novo_incidence?: number | null;
  readonly representative_variant_list?: {
    readonly uuid: string;
    readonly label: string;
    readonly total_genetic_prevalence: number;
    readonly supporting_documents: ReadonlyArray<{
      readonly url: string;
      readonly title: string;
    }>;
  } | null;
}

interface GeneResourceEntry {
  readonly label: string;
  readonly href?: string;
  readonly detail: ReactNode;
}

interface GeneResourceSection {
  readonly heading: string;
  readonly entries: ReadonlyArray<GeneResourceEntry>;
}

const UNAVAILABLE_LIGHT_GREY = "gray.400";
const UNAVAILABLE_DARK_GREY = "gray.500";
const GENE_METADATA_COLOR = "gray.600";
const PRELIMINARY_ESTIMATE_NOTICE_COLOR = "gray.700";

const RESOURCE_COLORS = {
  available: {
    heading: "blue.700",
    detail: "gray.600",
  },
  unavailable: {
    heading: UNAVAILABLE_DARK_GREY,
    detail: UNAVAILABLE_LIGHT_GREY,
  },
};

const INCIDENCE_UNAVAILABLE = -1.337;
const INCIDENCE_SCALE = 100_000;

const isAvailableEstimate = (
  estimate: number | null | undefined
): estimate is number => {
  return (
    typeof estimate === "number" && Number.isFinite(estimate) && estimate >= 0
  );
};

const getResourceSections = (
  gene: DashboardGeneResourceData
): GeneResourceSection[] => {
  let prevalence: GeneResourceEntry = {
    label: "Preliminary genetic prevalence",
    detail: "Estimate unavailable.",
  };
  if (gene.inheritance_type === "AD") {
    prevalence = {
      ...prevalence,
      detail: "Not applicable for autosomal dominant inheritance.",
    };
  } else if (isAvailableEstimate(gene.estimated_genetic_prevalence)) {
    prevalence = {
      ...prevalence,
      href: `/dashboard/${gene.gene_id}`,
      detail: renderFrequencyFraction(gene.estimated_genetic_prevalence),
    };
  }

  let incidence: GeneResourceEntry = {
    label: "Genetic incidence of de novo variation",
    detail: "Estimate unavailable.",
  };
  if (
    gene.estimated_de_novo_incidence !== INCIDENCE_UNAVAILABLE &&
    isAvailableEstimate(gene.estimated_de_novo_incidence)
  ) {
    incidence = {
      ...incidence,
      href: `/dashboard-incidence/${gene.gene_id}`,
      detail: `${(gene.estimated_de_novo_incidence * INCIDENCE_SCALE).toFixed(
        3
      )} per 100,000`,
    };
  }

  let representativeList: GeneResourceEntry = {
    label: "Representative variant list and curated estimate",
    detail: "No curated representative list available.",
  };
  const variantList = gene.representative_variant_list;
  if (variantList) {
    representativeList = {
      ...representativeList,
      href: `/variant-lists/${variantList.uuid}`,
      detail: (
        <>
          {variantList.label} ·{" "}
          {renderFrequencyFraction(variantList.total_genetic_prevalence)}
        </>
      ),
    };
  }

  return [
    { heading: "GenIE estimates", entries: [prevalence, incidence] },
    {
      heading: "Curated evidence",
      entries: [
        representativeList,
        ...(variantList?.supporting_documents ?? []).map((document) => ({
          label: document.title || "Supporting document",
          href: document.url,
          detail: "Supporting document for the curated estimate",
        })),
      ],
    },
  ];
};

const DashboardGeneResources = ({
  gene,
}: {
  gene: DashboardGeneResourceData;
}): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const sections = getResourceSections(gene);

  return (
    <>
      <Button
        variant="link"
        colorScheme="blue"
        fontWeight="inherit"
        textDecoration="underline"
        aria-label={`Explore resources for ${gene.gene_symbol}`}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        {gene.gene_symbol}
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader pr={12}>{gene.gene_symbol} resources</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text color={GENE_METADATA_COLOR} mb={1}>
              {gene.gene_id} · Inheritance: {gene.inheritance_type}
            </Text>
            <Text
              fontSize="sm"
              color={PRELIMINARY_ESTIMATE_NOTICE_COLOR}
              mb={6}
            >
              Estimates may be preliminary; review the linked details before
              use.
            </Text>
            <Stack spacing={6}>
              {sections.map((section) => {
                return (
                  <Box key={section.heading}>
                    <Heading as="h3" size="sm" mb={3}>
                      {section.heading}
                    </Heading>
                    <Stack as="ul" listStyleType="none" m={0} spacing={2}>
                      {section.entries.map((entry, index) => {
                        const colors = entry.href
                          ? RESOURCE_COLORS.available
                          : RESOURCE_COLORS.unavailable;
                        const content = (
                          <>
                            <Text
                              as="span"
                              fontWeight="semibold"
                              color={colors.heading}
                            >
                              {entry.label}
                            </Text>
                            <Text fontSize="sm" color={colors.detail} mt={1}>
                              {entry.detail}
                            </Text>
                          </>
                        );
                        const linkedEntry = (
                          <Link
                            href={entry.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            display="block"
                            borderWidth="1px"
                            borderRadius="md"
                            p={3}
                            color={colors.heading}
                            _hover={{ bg: "blue.50", textDecoration: "none" }}
                          >
                            {content}
                          </Link>
                        );
                        const unavailableEntry = (
                          <Box borderWidth="1px" borderRadius="md" p={3}>
                            {content}
                          </Box>
                        );
                        return (
                          <Box as="li" key={`${entry.label}-${index}`}>
                            {entry.href ? linkedEntry : unavailableEntry}
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default DashboardGeneResources;
