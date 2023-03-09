variable "gcp_project" {
  description = "GCP project"
  type        = string
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "google_oauth_client_id" {
  description = "Google OAuth client ID"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository"
  type        = string
  default     = "broadinstitute/genetic-prevalence-estimator"
}

variable "domain" {
  description = "Domain"
  type        = string
  default     = "genie.broadinstitute.org"
}
