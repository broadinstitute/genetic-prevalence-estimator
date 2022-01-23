resource "google_project_service" "enable_iam" {
  service = "iam.googleapis.com"
}

resource "google_project_service" "enable_container_registry" {
  service = "containerregistry.googleapis.com"
}

resource "google_project_service" "enable_cloud_build" {
  service = "cloudbuild.googleapis.com"
}

resource "google_project_service" "enable_dataproc" {
  service = "dataproc.googleapis.com"
}
