import { GnomadPopulationId } from "../types";

export const GNOMAD_POPULATION_NAMES: {
  [key in GnomadPopulationId]: string;
} = {
  afr: "African/African-American",
  ami: "Amish",
  amr: "Latino/Admixed American",
  asj: "Ashkenazi Jewish",
  eas: "East Asian",
  fin: "European (Finnish)",
  mid: "Middle Eastern",
  nfe: "European (non-Finnish)",
  oth: "Other",
  sas: "South Asian",
};
