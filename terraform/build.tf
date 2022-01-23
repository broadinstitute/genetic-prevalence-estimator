resource "google_container_registry" "registry" {
  depends_on = [
    google_project_service.enable_container_registry,
  ]
}

resource "google_service_account" "builder" {
  account_id  = "builder"
  description = "Used by Cloud Build to build and deploy application"
}

resource "google_storage_bucket_iam_member" "builder_gcr_storage_admin" {
  bucket = google_container_registry.registry.id
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.builder.email}"
}

resource "google_storage_bucket" "build_logs_bucket" {
  name                        = "${var.gcp_project}-build-logs"
  location                    = var.gcp_region
  uniform_bucket_level_access = true

  labels = {
    bucket : "${var.gcp_project}-build-logs"
  }
}

resource "google_storage_bucket_iam_member" "builder_build_logs_storage_admin" {
  bucket = google_storage_bucket.build_logs_bucket.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.builder.email}"
}

resource "google_cloudbuild_trigger" "build_app_trigger" {
  name        = "build-and-deploy-app-trigger"
  description = "Build and deploy application"

  github {
    owner = split("/", var.github_repository)[0]
    name  = split("/", var.github_repository)[1]

    push {
      branch = "^cloudbuild$"
    }
  }

  service_account = google_service_account.builder.id

  depends_on = [
    google_storage_bucket_iam_member.builder_build_logs_storage_admin,
    google_storage_bucket_iam_member.builder_gcr_storage_admin,
  ]

  build {
    logs_bucket = "gs://${google_storage_bucket.build_logs_bucket.name}/build"
    timeout     = "1200s"

    options {
      logging = "GCS_ONLY"
    }

    step {
      id   = "build-website"
      name = "gcr.io/kaniko-project/executor:latest"
      args = [
        "--dockerfile=website/website.dockerfile",
        "--destination=gcr.io/$PROJECT_ID/website:$COMMIT_SHA",
        "--destination=gcr.io/$PROJECT_ID/website:latest",
        "--cache=true",
        "--cache-ttl=168h",
      ]
    }

    step {
      id   = "build-worker"
      name = "gcr.io/kaniko-project/executor:latest"
      args = [
        "--dockerfile=worker/worker.dockerfile",
        "--destination=gcr.io/$PROJECT_ID/worker:$COMMIT_SHA",
        "--destination=gcr.io/$PROJECT_ID/worker:latest",
      ]
      wait_for = ["-"]
    }
  }
}
