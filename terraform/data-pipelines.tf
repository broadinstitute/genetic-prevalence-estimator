resource "google_storage_bucket" "data_bucket" {
  name                        = "${var.gcp_project}-data"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  labels = {
    bucket : "${var.gcp_project}-data"
  }
}

resource "google_service_account" "data_pipeline" {
  account_id  = "data-pipeline"
  description = "Used for Dataproc clusters running data pipelines"
}

resource "google_project_iam_member" "data_pipeline_dataproc_worker" {
  project = data.google_project.project.id
  role    = "roles/dataproc.worker"
  member  = "serviceAccount:${google_service_account.data_pipeline.email}"
}

resource "google_storage_bucket_iam_member" "data_pipeline_data_storage_admin" {
  bucket = google_storage_bucket.data_bucket.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.data_pipeline.email}"
}
