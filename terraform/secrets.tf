# =============================================================================

resource "google_secret_manager_secret" "app_db_user_password" {
  secret_id  = "app-db-user-password"
  depends_on = [google_project_service.enable_secret_manager]

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "app_db_user_password" {
  secret      = google_secret_manager_secret.app_db_user_password.id
  secret_data = google_sql_user.app_db_user.password
}

# =============================================================================

resource "random_password" "website_secret_key" {
  length  = 24
  special = true
}

resource "google_secret_manager_secret" "website_secret_key" {
  secret_id  = "website-secret-key"
  depends_on = [google_project_service.enable_secret_manager]

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "website_secret_key" {
  secret      = google_secret_manager_secret.website_secret_key.id
  secret_data = random_password.website_secret_key.result
}
