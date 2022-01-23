variable "gcp_project" {
  description = "GCP project"
  type        = string
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "github_repository" {
  description = "GitHub repository"
  type        = string
  default     = "broadinstitute/aggregate-frequency-calculator"
}
