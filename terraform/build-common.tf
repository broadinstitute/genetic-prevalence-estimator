resource "google_storage_bucket" "build_logs_bucket" {
  name                        = "${var.gcp_project}-build-logs"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  labels = {
    bucket : "${var.gcp_project}-build-logs"
  }
}
