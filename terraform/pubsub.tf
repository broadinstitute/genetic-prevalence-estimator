resource "google_service_account" "worker_pubsub_subscription" {
  account_id  = "worker-subscription"
  description = "Used for worker pubsub subscription"
}

# https://cloud.google.com/pubsub/docs/push#setting_up_for_push_authentication
resource "google_project_iam_member" "pubsub_auth_token_creator" {
  project    = data.google_project.project.id
  role       = "roles/iam.serviceAccountTokenCreator"
  member     = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
  depends_on = [google_project_service.pubsub]
}

resource "google_cloud_run_service_iam_member" "worker_pubsub_subscription_invoker" {
  service  = google_cloud_run_service.worker.name
  location = google_cloud_run_service.worker.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.worker_pubsub_subscription.email}"
}

resource "google_pubsub_topic" "worker_requests" {
  name       = "worker-requests"
  depends_on = [google_project_service.pubsub]
}

resource "google_pubsub_topic" "failed_worker_requests" {
  name       = "failed-worker-requests"
  depends_on = [google_project_service.pubsub]
}

resource "google_pubsub_topic_iam_member" "pubsub_service_agent_failed_worker_requests_publisher" {
  topic  = google_pubsub_topic.failed_worker_requests.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription_iam_member" "pubsub_service_agent_worker_requests_subscriber" {
  subscription = google_pubsub_subscription.worker_requests_subscription.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription" "worker_requests_subscription" {
  name  = "worker-requests-subscription"
  topic = google_pubsub_topic.worker_requests.name

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = google_cloud_run_service.worker.status[0].url

    oidc_token {
      service_account_email = google_service_account.worker_pubsub_subscription.email
    }

    attributes = {
      x-goog-version = "v1"
    }
  }

  retry_policy {
    minimum_backoff = "30s"
    maximum_backoff = "300s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.failed_worker_requests.id
    max_delivery_attempts = 5
  }

  expiration_policy {
    ttl = ""
  }
}
