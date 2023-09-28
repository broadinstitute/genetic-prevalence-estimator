export type GnomadVersion = "2.1.1" | "3.1.2";

export type GnomadPopulationId =
  | "global"
  | "afr"
  | "ami"
  | "amr"
  | "asj"
  | "eas"
  | "eas/jpn"
  | "eas/kor"
  | "eas/oea"
  | "fin"
  | "mid"
  | "nfe"
  | "nfe/bgr"
  | "nfe/est"
  | "nfe/nwe"
  | "nfe/onf"
  | "nfe/seu"
  | "nfe/swe"
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
  revel_score?: string | null;
  gene_id?: string | null;
  gene_symbol?: string | null;
  transcript_id?: string | null;
  AC?: number[];
  AN?: number[];
  sample_sets?: ("exome" | "genome")[] | null;
  filters?: {
    exome?: string[] | null;
    genome?: string[] | null;
  } | null;
  flags?: string[];
  clinvar_variation_id?: string | null;
  clinical_significance?: string[] | null;
  gold_stars?: number | null;
  lof_curation?: { verdict: string; flags: string[]; project: string } | null;
  source?: VariantSource[];
}

export type VariantListStatus = "Queued" | "Processing" | "Ready" | "Error";

export enum VariantListReviewStatusCode {
  PENDING = "Pending",
  REJECTED = "Rejected",
  APPROVED = "Approved",
}

export enum VariantListAccessLevel {
  OWNER = "Owner",
  EDITOR = "Editor",
  VIEWER = "Viewer",
}

export enum VariantListType {
  CUSTOM = "c",
  RECOMMENDED = "r",
}

export interface VariantListMetadata {
  gnomad_version: GnomadVersion;
  reference_genome?: ReferenceGenome;

  gene_id?: string;
  transcript_id?: string;
  gene_symbol?: string;

  include_gnomad_plof?: boolean;
  include_gnomad_missense_with_high_revel_score?: boolean;
  include_clinvar_clinical_significance?:
    | ClinvarClinicalSignificanceCategory[]
    | null;

  clinvar_version?: string;
  populations?: GnomadPopulationId[];
}

export interface VariantListRequest {
  label: string;
  notes: string;
  type: VariantListType;
  metadata: VariantListMetadata;
  variants?: Variant[];
}

interface VariantListAccessPermission {
  uuid: string;
  user: string;
  level: VariantListAccessLevel;
}

export interface VariantList {
  uuid: string;
  label: string;
  notes: string;
  type: VariantListType;
  metadata: VariantListMetadata;
  created_at: string;
  updated_at: string;
  access_level?: VariantListAccessLevel;
  access_permissions?: VariantListAccessPermission[];
  status: VariantListStatus;
  public_status?: VariantListReviewStatusCode | "";
  error?: string;
  variants: Variant[];
}
