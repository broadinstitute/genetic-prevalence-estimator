import { GnomadPopulationId } from "../types";

export const GNOMAD_POPULATION_NAMES: {
  [key in GnomadPopulationId]: string;
} = {
  global: "Global",
  afr: "African/African-American",
  ami: "Amish",
  amr: "Latino/Admixed American",
  asj: "Ashkenazi Jewish",
  eas: "East Asian",
  "eas/jpn": "Japanese",
  "eas/kor": "Korean",
  "eas/oea": "Other East Asian",
  fin: "European (Finnish)",
  mid: "Middle Eastern",
  nfe: "European (non-Finnish)",
  "nfe/bgr": "Bulgarian",
  "nfe/est": "Estonian",
  "nfe/nwe": "North-western European",
  "nfe/onf": "Other non-Finnish European",
  "nfe/seu": "Southern European",
  "nfe/swe": "Swedish",
  oth: "Other",
  sas: "South Asian",
};

export const isSubcontinentalPopulation = (
  populationId: GnomadPopulationId
): boolean => populationId.includes("/");
