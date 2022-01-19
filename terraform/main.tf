terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "3.72.0"
    }
  }

  backend "gcs" {
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.gcp_project
  region  = var.gcp_region
}

resource "google_project_service" "enable_dataproc" {
  service = "dataproc.googleapis.com"
}

resource "google_storage_bucket" "data_bucket" {
  name                        = "${var.gcp_project}-data"
  location                    = var.gcp_region
  uniform_bucket_level_access = true
}