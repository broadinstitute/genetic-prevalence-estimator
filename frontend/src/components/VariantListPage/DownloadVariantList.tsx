import { Link, LinkProps } from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";

import { VEP_CONSEQUENCE_LABELS } from "../../constants/vepConsequences";

import { Variant, VariantList } from "../../types";

export const renderVariantsToTSV = (variants: Variant[]) => {
  const columns = [
    {
      label: "Variant ID",
      getValue: (variant: Variant) => variant.id,
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
  ];

  const headerRow = columns.map((c) => c.label);

  return (
    [
      headerRow,
      ...variants.map((variant) =>
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
}

export const DownloadVariantListLink: FC<DownloadVariantListLinkProps> = ({
  variantList,
  ...linkProps
}) => {
  const [linkUrl, setLinkUrl] = useState("");
  useEffect(() => {
    const tsv = renderVariantsToTSV(variantList.variants);
    const blob = new Blob([tsv], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    setLinkUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [variantList]);

  return (
    <Link
      {...linkProps}
      variant="button"
      download={`${variantList.label}.tsv`}
      href={linkUrl}
    />
  );
};
