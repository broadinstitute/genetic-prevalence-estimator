resource "google_service_account" "worker" {
  account_id  = "worker"
  description = "Used by worker service"
}

resource "google_project_iam_member" "worker_cloud_sql_client" {
  project = data.google_project.project.id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_secret_manager_secret_iam_member" "worker_access_app_db_user_password" {
  secret_id = google_secret_manager_secret.app_db_user_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_secret_manager_secret_iam_member" "worker_access_worker_secret_key" {
  secret_id = google_secret_manager_secret.worker_secret_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_storage_bucket_iam_member" "worker_data_viewer" {
  bucket = google_storage_bucket.data_bucket.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_cloud_run_service" "worker" {
  name     = "worker"
  location = var.gcp_region

  depends_on = [
    google_project_service.cloud_run,
    google_project_iam_member.worker_cloud_sql_client,
    google_secret_manager_secret_iam_member.worker_access_app_db_user_password,
    google_secret_manager_secret_iam_member.worker_access_worker_secret_key,
  ]

  template {
    spec {
      service_account_name = google_service_account.worker.email

      containers {
        image = "gcr.io/${var.gcp_project}/worker"

        env {
          name  = "DJANGO_SETTINGS_MODULE"
          value = "worker.settings.production"
        }

        env {
          name  = "DB_ENGINE"
          value = "django.db.backends.postgresql"
        }

        env {
          name  = "DB_DATABASE"
          value = google_sql_database.app_db.name
        }

        env {
          name  = "DB_HOST"
          value = "/cloudsql/${google_sql_database_instance.app_db_instance.connection_name}"
        }

        env {
          name  = "DB_USER"
          value = google_sql_user.app_db_user.name
        }

        env {
          name = "DB_PASSWORD"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.app_db_user_password.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SECRET_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.worker_secret_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name  = "ALLOWED_HOSTS"
          value = "*"
        }

        env {
          name  = "SECURE_PROXY_SSL_HEADER"
          value = "HTTP_X_FORWARDED_PROTO:https"
        }

        env {
          name  = "GNOMAD_DATA_PATH"
          value = "gs://${google_storage_bucket.data_bucket.name}/gnomAD"
        }

        env {
          name  = "CLINVAR_DATA_PATH"
          value = "gs://${google_storage_bucket.data_bucket.name}/ClinVar"
        }

        env {
          name = "SPARK_CONF"
          value = jsonencode({
            "spark.ui.enabled"  = "false",
            "spark.driver.host" = "localhost"
          })
        }

        env {
          name  = "SPARK_LOCAL_IP"
          value = "127.0.0.1"
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "4Gi"
          }
        }
      }

      container_concurrency = 1
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"      = "1"
        "run.googleapis.com/cloudsql-instances" = google_sql_database_instance.app_db_instance.connection_name
      }
    }
  }

  lifecycle {
    ignore_changes = [
      // Ignore image and annotations set by `gcloud run deploy`
      template[0].spec[0].containers[0].image,
      template[0].metadata[0].annotations["client.knative.dev/user-image"],
      template[0].metadata[0].annotations["run.googleapis.com/client-name"],
      template[0].metadata[0].annotations["run.googleapis.com/client-version"]
    ]
  }

  autogenerate_revision_name = true
}
