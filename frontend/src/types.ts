export type GnomadVersion = "2" | "3";

export type LofteeAnnotation = "HC" | "LC";

export type ClinvarClinicalSignificanceCategory =
  | "pathogenic"
  | "uncertain"
  | "benign"
  | "other";

export type ReferenceGenome = "GRCh37" | "GRCh38";

export type VariantId = string;

export type VariantListState = "queued" | "processing" | "ready" | "error";

export interface GnomadVariantListDefinition {
  version: "1";
  gnomad_version: GnomadVersion;
  gene_id: string;
  filter_loftee: LofteeAnnotation[] | null;
  filter_clinvar_clinical_significance:
    | ClinvarClinicalSignificanceCategory[]
    | null;
}

export interface CustomVariantListDefinition {
  version: "1";
  reference_genome: ReferenceGenome;
}

export interface GnomadVariantListRequest {
  label: string;
  description: string;
  type: "gnomad";
  definition: GnomadVariantListDefinition;
}

export interface CustomVariantListRequest {
  label: string;
  description: string;
  type: "custom";
  definition: CustomVariantListDefinition;
  variants: VariantId[];
}

interface VariantListBase {
  uuid: string;
  label: string;
  description: string;
  created_at: string;
  updated_at: string;
  state: VariantListState;
  variants: VariantId[];
}

export interface GnomadVariantList extends VariantListBase {
  type: "gnomad";
  definition: GnomadVariantListDefinition;
}

export interface CustomVariantList extends VariantListBase {
  type: "custom";
  definition: CustomVariantListDefinition;
}

export type VariantListRequest =
  | GnomadVariantListRequest
  | CustomVariantListRequest;

export type VariantList = GnomadVariantList | CustomVariantList;
