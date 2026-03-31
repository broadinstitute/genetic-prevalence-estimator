resource "google_service_account" "db_migrations" {
  account_id  = "db-migrations"
  description = "Used by Cloud Build to run database migrations"
}

resource "google_storage_bucket_iam_member" "db_migrations_build_logs_storage_admin" {
  bucket = google_storage_bucket.build_logs_bucket.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.db_migrations.email}"
}

resource "google_storage_bucket_iam_member" "db_migrations_gcr_storage_admin" {
  bucket = google_container_registry.registry.id
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.db_migrations.email}"
}

resource "google_project_iam_member" "db_migrations_cloud_sql_client" {
  project = data.google_project.project.id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.db_migrations.email}"
}

resource "google_secret_manager_secret_iam_member" "db_migrations_app_db_user_password" {
  secret_id = google_secret_manager_secret.app_db_user_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.db_migrations.email}"
}

resource "google_cloudbuild_trigger" "db_migrations" {
  name        = "db-migrations"
  description = "Migrate database"

  source_to_build {
    uri       = "https://github.com/${var.github_repository}"
    ref       = "refs/head/main"
    repo_type = "GITHUB"
  }

  service_account = google_service_account.db_migrations.id

  depends_on = [
    google_storage_bucket_iam_member.db_migrations_build_logs_storage_admin,
    google_storage_bucket_iam_member.db_migrations_gcr_storage_admin,
    google_project_iam_member.db_migrations_cloud_sql_client,
    google_secret_manager_secret_iam_member.db_migrations_app_db_user_password,
  ]

  build {
    logs_bucket = "gs://${google_storage_bucket.build_logs_bucket.name}/db_migrations"
    timeout     = "1200s"

    options {
      logging = "GCS_ONLY"
    }

    available_secrets {
      secret_manager {
        env          = "DB_PASSWORD"
        version_name = google_secret_manager_secret_version.app_db_user_password.name
      }
    }

    step {
      id   = "build-website"
      name = "gcr.io/kaniko-project/executor:latest"
      args = [
        "--dockerfile=website/website.dockerfile",
        "--no-push",
      ]
    }

    step {
      id   = "apply-migrations"
      name = "gcr.io/google-appengine/exec-wrapper"
      args = [
        "-i",
        "us-central1-docker.pkg.dev/$PROJECT_ID/genetic-prevalence-estimator/website:$COMMIT_SHA",
        "-s",
        "${google_sql_database_instance.app_db_instance.connection_name}",
        "-e",
        "DB_ENGINE=django.db.backends.postgresql",
        "-e",
        "DB_HOST=/cloudsql/${google_sql_database_instance.app_db_instance.connection_name}",
        "-e",
        "DB_PORT=5432",
        "-e",
        "DB_DATABASE=${google_sql_database.app_db.name}",
        "-e",
        "DB_USER=${google_sql_user.app_db_user.name}",
        "-e",
        "DB_PASSWORD",
        "--",
        "django-admin",
        "migrate",
      ]
      secret_env = ["DB_PASSWORD"]
    }
  }
}
