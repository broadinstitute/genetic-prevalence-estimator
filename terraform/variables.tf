variable "gcp_project" {
  description = "GCP project"
  type        = string
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "data_bucket" {
  description = "GCS bucket for storing application data"
  type        = string
}
