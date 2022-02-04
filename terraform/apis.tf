resource "google_project_service" "enable_iam" {
  service = "iam.googleapis.com"
}

resource "google_project_service" "enable_container_registry" {
  service = "containerregistry.googleapis.com"
}

resource "google_project_service" "enable_cloud_build" {
  service = "cloudbuild.googleapis.com"
}

resource "google_project_service" "enable_cloud_sql" {
  service = "sqladmin.googleapis.com"
}

resource "google_project_service" "enable_service_networking" {
  service = "servicenetworking.googleapis.com"
}

resource "google_project_service" "enable_secret_manager" {
  service = "secretmanager.googleapis.com"
}

resource "google_project_service" "enable_cloud_run" {
  service = "run.googleapis.com"
}

resource "google_project_service" "enable_dataproc" {
  service = "dataproc.googleapis.com"
}
