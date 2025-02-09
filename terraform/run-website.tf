resource "google_service_account" "website" {
  account_id  = "website"
  description = "Used by website service"
}

resource "google_project_iam_member" "website_cloud_sql_client" {
  project = data.google_project.project.id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.website.email}"
}

resource "google_secret_manager_secret_iam_member" "website_access_app_db_user_password" {
  secret_id = google_secret_manager_secret.app_db_user_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.website.email}"
}

resource "google_secret_manager_secret_iam_member" "website_access_website_secret_key" {
  secret_id = google_secret_manager_secret.website_secret_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.website.email}"
}

resource "google_pubsub_topic_iam_member" "website_worker_requests_publisher" {
  topic  = google_pubsub_topic.worker_requests.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.website.email}"
}

resource "google_cloud_run_service" "website" {
  name     = "website"
  location = var.gcp_region

  depends_on = [
    google_project_service.cloud_run,
    google_secret_manager_secret_iam_member.website_access_app_db_user_password,
    google_secret_manager_secret_iam_member.website_access_website_secret_key,
  ]

  template {
    spec {
      service_account_name = google_service_account.website.email

      containers {
        image = "gcr.io/${var.gcp_project}/website"

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
              name = google_secret_manager_secret.website_secret_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SLACK_WEBHOOK_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.slack_webhook_url.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SLACK_USER_ID"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.slack_user_id.secret_id
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
          name  = "GCP_PROJECT"
          value = data.google_project.project.project_id
        }

        env {
          name  = "GOOGLE_AUTH_CLIENT_ID"
          value = var.google_oauth_client_id
        }

        env {
          name  = "MAX_VARIANT_LISTS_PER_USER"
          value = "100"
        }
      }
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

data "google_iam_policy" "public_access" {
  binding {
    role = "roles/run.invoker"
    members = [
      "allUsers",
    ]
  }
}

resource "google_cloud_run_service_iam_policy" "website_public_access" {
  location = google_cloud_run_service.website.location
  project  = google_cloud_run_service.website.project
  service  = google_cloud_run_service.website.name

  policy_data = data.google_iam_policy.public_access.policy_data
}

resource "google_compute_region_network_endpoint_group" "website_serverless_neg" {
  name                  = "website-serverless-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.gcp_region

  cloud_run {
    service = google_cloud_run_service.website.name
  }
}

// https://cloud.google.com/load-balancing/docs/https/ext-http-lb-tf-module-examples#with_a_backend
// https://registry.terraform.io/modules/GoogleCloudPlatform/lb-http/google/latest/submodules/serverless_negs
module "website-external-lb" {
  source  = "GoogleCloudPlatform/lb-http/google//modules/serverless_negs"
  version = "7.0.0"

  project = var.gcp_project
  name    = "website-external-lb"

  ssl                             = true
  managed_ssl_certificate_domains = [var.domain]
  https_redirect                  = true

  backends = {
    default = {
      description = null

      protocol  = null
      port_name = null

      compression_mode        = null
      custom_request_headers  = null
      custom_response_headers = null
      enable_cdn              = false
      security_policy         = null

      groups = [
        {
          group = google_compute_region_network_endpoint_group.website_serverless_neg.id
        }
      ]

      iap_config = {
        enable               = false
        oauth2_client_id     = null
        oauth2_client_secret = null
      }

      log_config = {
        enable      = true
        sample_rate = 1.0
      }
    }
  }
}
