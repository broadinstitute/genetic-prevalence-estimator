resource "google_service_account" "builder" {
  account_id  = "builder"
  description = "Used by Cloud Build to build and deploy application"
}

resource "google_storage_bucket_iam_member" "builder_gcr_storage_admin" {
  bucket = google_container_registry.registry.id
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.builder.email}"
}

resource "google_storage_bucket_iam_member" "builder_build_logs_storage_admin" {
  bucket = google_storage_bucket.build_logs_bucket.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.builder.email}"
}

resource "google_project_iam_member" "builder_cloud_run_admin" {
  project = data.google_project.project.id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.builder.email}"
}

resource "google_service_account_iam_member" "builder_act_as_website" {
  service_account_id = google_service_account.website.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.builder.email}"
}

resource "google_service_account_iam_member" "builder_act_as_worker" {
  service_account_id = google_service_account.worker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.builder.email}"
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
      id         = "deploy-website"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "run",
        "deploy",
        google_cloud_run_service.website.name,
        "--image",
        "gcr.io/$PROJECT_ID/website:$COMMIT_SHA",
        "--region",
        google_cloud_run_service.website.location,
      ]
      wait_for = ["build-website"]
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

    step {
      id         = "deploy-worker"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "run",
        "deploy",
        google_cloud_run_service.worker.name,
        "--image",
        "gcr.io/$PROJECT_ID/worker:$COMMIT_SHA",
        "--region",
        google_cloud_run_service.worker.location,
      ]
      wait_for = ["build-worker"]
    }
  }
}
