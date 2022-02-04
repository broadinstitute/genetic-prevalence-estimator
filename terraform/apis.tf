resource "google_project_service" "iam" {
  service = "iam.googleapis.com"
}

resource "google_project_service" "container_registry" {
  service = "containerregistry.googleapis.com"
}

resource "google_project_service" "cloud_build" {
  service = "cloudbuild.googleapis.com"
}

resource "google_project_service" "cloud_sql" {
  service = "sqladmin.googleapis.com"
}

resource "google_project_service" "service_networking" {
  service = "servicenetworking.googleapis.com"
}

resource "google_project_service" "secret_manager" {
  service = "secretmanager.googleapis.com"
}

resource "google_project_service" "cloud_run" {
  service = "run.googleapis.com"
}

resource "google_project_service" "dataproc" {
  service = "dataproc.googleapis.com"
}
