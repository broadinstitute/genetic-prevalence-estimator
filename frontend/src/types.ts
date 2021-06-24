export type GnomadVersion = "2" | "3";

export type LofteeAnnotation = "HC" | "LC";

export type ClinvarClinicalSignificanceCategory =
  | "pathogenic"
  | "uncertain"
  | "benign"
  | "other";

export type ReferenceGenome = "GRCh37" | "GRCh38";

export type VariantId = string;

export type VariantListStatus = "Queued" | "Processing" | "Ready" | "Error";

export enum VariantListAccessLevel {
  OWNER = "Owner",
  EDITOR = "Editor",
  VIEWER = "Viewer",
}

export interface GnomadVariantListMetadata {
  version: "1";
  gnomad_version: GnomadVersion;
  gene_id: string;
  filter_loftee: LofteeAnnotation[] | null;
  filter_clinvar_clinical_significance:
    | ClinvarClinicalSignificanceCategory[]
    | null;
}

export interface CustomVariantListMetadata {
  version: "1";
  reference_genome: ReferenceGenome;
}

export interface GnomadVariantListRequest {
  label: string;
  description: string;
  type: "gnomad";
  metadata: GnomadVariantListMetadata;
}

export interface CustomVariantListRequest {
  label: string;
  description: string;
  type: "custom";
  metadata: CustomVariantListMetadata;
  variants: VariantId[];
}

interface VariantListBase {
  uuid: string;
  label: string;
  description: string;
  created_at: string;
  updated_at: string;
  access_level: VariantListAccessLevel;
  status: VariantListStatus;
  variants: VariantId[];
}

export interface GnomadVariantList extends VariantListBase {
  type: "gnomad";
  metadata: GnomadVariantListMetadata;
}

export interface CustomVariantList extends VariantListBase {
  type: "custom";
  metadata: CustomVariantListMetadata;
}

export type VariantListRequest =
  | GnomadVariantListRequest
  | CustomVariantListRequest;

export type VariantList = GnomadVariantList | CustomVariantList;
