import { Link, LinkProps } from "@chakra-ui/react";
import { FC, useEffect, useState } from "react";

import { renderVepConsequence } from "./vepConsequences";

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
          ? renderVepConsequence(variant.major_consequence)
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
      label: "Allele count",
      getValue: (variant: Variant) => (variant.AC || [])[0],
    },
    {
      label: "Allele number",
      getValue: (variant: Variant) => (variant.AN || [])[0],
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
