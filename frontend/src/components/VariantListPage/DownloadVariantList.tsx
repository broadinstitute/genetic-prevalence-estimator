import { Link, LinkProps } from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";

import { GNOMAD_POPULATION_NAMES } from "../../constants/populations";
import { VEP_CONSEQUENCE_LABELS } from "../../constants/vepConsequences";

import { GnomadPopulationId, Variant, VariantList } from "../../types";

export const renderVariantsToTSV = (
  variantList: VariantList,
  includePopulationFrequencies: GnomadPopulationId[] = []
) => {
  const includedPopulationIndices = includePopulationFrequencies.map(
    (popId) => variantList.metadata.populations!.indexOf(popId) + 1
  );

  const columns = [
    {
      label: "Variant ID",
      getValue: (variant: Variant) => variant.id,
    },
    {
      label: "Gene",
      getValue: (variant: Variant) => variant.gene_id,
    },
    {
      label: "Transcript",
      getValue: (variant: Variant) => variant.transcript_id,
    },
    {
      label: "VEP consequence",
      getValue: (variant: Variant) =>
        variant.major_consequence
          ? VEP_CONSEQUENCE_LABELS.get(variant.major_consequence)
          : "",
    },
    {
      label: "LOFTEE",
      getValue: (variant: Variant) => variant.lof,
    },
    {
      label: "LoF curation",
      getValue: (variant: Variant) =>
        variant.lof_curation
          ? `${variant.lof_curation.verdict} (${variant.lof_curation.flags.join(
              ", "
            )})`
          : "",
    },
    {
      label: "HGVSc",
      getValue: (variant: Variant) => variant.hgvsc,
    },
    {
      label: "HGVSp",
      getValue: (variant: Variant) => variant.hgvsp,
    },
    {
      label: "Clinical significance",
      getValue: (variant: Variant) => variant.clinical_significance?.join(", "),
    },
    {
      label: "ClinVar variation ID",
      getValue: (variant: Variant) => variant.clinvar_variation_id,
    },
    {
      label: "Allele count",
      getValue: (variant: Variant) => (variant.AC || [])[0],
    },
    {
      label: "Allele number",
      getValue: (variant: Variant) => (variant.AN || [])[0],
    },
    {
      label: "Allele frequency",
      getValue: (variant: Variant) => {
        const ac = (variant.AC || [])[0];
        const an = (variant.AN || [])[0];
        return ac === 0 ? 0 : ac / an;
      },
    },
    ...includePopulationFrequencies.flatMap((popId, i) => {
      const popIndex = includedPopulationIndices[i];
      return [
        {
          label: `Allele count (${GNOMAD_POPULATION_NAMES[popId]})`,
          getValue: (variant: Variant) => (variant.AC || [])[popIndex],
        },
        {
          label: `Allele number (${GNOMAD_POPULATION_NAMES[popId]})`,
          getValue: (variant: Variant) => (variant.AN || [])[popIndex],
        },
        {
          label: `Allele frequency (${GNOMAD_POPULATION_NAMES[popId]})`,
          getValue: (variant: Variant) => {
            const ac = (variant.AC || [])[popIndex];
            const an = (variant.AN || [])[popIndex];
            return ac === 0 ? 0 : ac / an;
          },
        },
      ];
    }),
  ];

  const headerRow = columns.map((c) => c.label);

  return (
    [
      headerRow,
      ...variantList.variants.map((variant) =>
        columns.map((column) => {
          const value = column.getValue(variant);
          return value === null ? "" : value;
        })
      ),
    ]
      .map((row) => row.join("\t"))
      .join("\r\n") + "\r\n"
  );
};

interface DownloadVariantListLinkProps extends LinkProps {
  variantList: VariantList;
  includePopulationFrequencies: GnomadPopulationId[];
}

export const DownloadVariantListLink: FC<DownloadVariantListLinkProps> = ({
  variantList,
  includePopulationFrequencies = [],
  ...linkProps
}) => {
  const [linkUrl, setLinkUrl] = useState("");
  useEffect(() => {
    const tsv = renderVariantsToTSV(variantList, includePopulationFrequencies);
    const blob = new Blob([tsv], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    setLinkUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [variantList, includePopulationFrequencies]);

  return (
    <Link
      {...linkProps}
      variant="button"
      download={`${variantList.label}.tsv`}
      href={linkUrl}
    />
  );
};
