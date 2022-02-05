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
    google_project_service.container_registry,
  ]
}
