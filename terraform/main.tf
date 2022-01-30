terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "4.6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
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

provider "google-beta" {
  project = var.gcp_project
  region  = var.gcp_region
}

data "google_project" "project" {
}

resource "google_container_registry" "registry" {
  depends_on = [
    google_project_service.enable_container_registry,
  ]
}

resource "google_storage_bucket" "data_bucket" {
  name                        = "${var.gcp_project}-data"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  labels = {
    bucket : "${var.gcp_project}-data"
  }
}
