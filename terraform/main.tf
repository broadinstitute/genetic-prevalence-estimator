terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "4.6.0"
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

data "google_project" "project" {
}

resource "google_storage_bucket" "data_bucket" {
  name                        = "${var.gcp_project}-data"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  labels = {
    bucket : "${var.gcp_project}-data"
  }
}
