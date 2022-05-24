export type GnomadVersion = "2.1.1" | "3.1.2";

export type GnomadPopulationId =
  | "afr"
  | "ami"
  | "amr"
  | "asj"
  | "eas"
  | "fin"
  | "mid"
  | "nfe"
  | "oth"
  | "sas";

export type ClinvarClinicalSignificanceCategory =
  | "pathogenic_or_likely_pathogenic"
  | "conflicting_interpretations"
  | "uncertain_significance"
  | "benign_or_likely_benign"
  | "other";

export type ReferenceGenome = "GRCh37" | "GRCh38";

export type VariantId = string;

export type VariantSource = "gnomAD" | "ClinVar" | "Custom";

export interface Variant {
  id: VariantId;
  hgvsc?: string | null;
  hgvsp?: string | null;
  lof?: string | null;
  major_consequence?: string | null;
  AC?: number[];
  AN?: number[];
  flags?: string[];
  clinvar_variation_id?: string | null;
  clinical_significance?: string[] | null;
  gold_stars?: number | null;
  source?: VariantSource[];
}

export type VariantListStatus = "Queued" | "Processing" | "Ready" | "Error";

export enum VariantListAccessLevel {
  OWNER = "Owner",
  EDITOR = "Editor",
  VIEWER = "Viewer",
}

export enum VariantListType {
  CUSTOM = "c",
  RECOMMENDED = "r",
}

interface VariantListMetadataBase {
  gnomad_version: GnomadVersion;
  clinvar_version?: string;
  populations?: GnomadPopulationId[];
}

export interface RecommendedVariantListMetadata
  extends VariantListMetadataBase {
  version: "1";
  gene_id: string;
  transcript_id: string;
  included_clinvar_variants: ClinvarClinicalSignificanceCategory[] | null;
}

export interface CustomVariantListMetadata extends VariantListMetadataBase {
  version: "1";
  reference_genome: ReferenceGenome;
}

export interface RecommendedVariantListRequest {
  label: string;
  notes: string;
  type: VariantListType.RECOMMENDED;
  metadata: RecommendedVariantListMetadata;
}

export interface CustomVariantListRequest {
  label: string;
  notes: string;
  type: VariantListType.CUSTOM;
  metadata: CustomVariantListMetadata;
  variants: Variant[];
}

interface VariantListAccessPermission {
  uuid: string;
  user: string;
  level: VariantListAccessLevel;
}

interface VariantListBase {
  uuid: string;
  label: string;
  notes: string;
  created_at: string;
  updated_at: string;
  access_level?: VariantListAccessLevel;
  access_permissions?: VariantListAccessPermission[];
  status: VariantListStatus;
  error?: string;
  variants: Variant[];
}

export interface RecommendedVariantList extends VariantListBase {
  type: VariantListType.RECOMMENDED;
  metadata: RecommendedVariantListMetadata;
}

export interface CustomVariantList extends VariantListBase {
  type: VariantListType.CUSTOM;
  metadata: CustomVariantListMetadata;
}

export type VariantListRequest =
  | RecommendedVariantListRequest
  | CustomVariantListRequest;

export type VariantList = RecommendedVariantList | CustomVariantList;
