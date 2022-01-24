resource "google_secret_manager_secret" "app_db_instance_server_cert" {
  secret_id  = "app-db-instance-server-cert"
  depends_on = [google_project_service.enable_secret_manager]

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "app_db_instance_server_cert" {
  secret      = google_secret_manager_secret.app_db_instance_server_cert.id
  secret_data = google_sql_database_instance.app_db_instance.server_ca_cert[0].cert
}

# =============================================================================

resource "google_secret_manager_secret" "app_db_instance_client_cert" {
  secret_id  = "app-db-instance-client-cert"
  depends_on = [google_project_service.enable_secret_manager]

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "app_db_instance_client_cert" {
  secret      = google_secret_manager_secret.app_db_instance_client_cert.id
  secret_data = google_sql_ssl_cert.app_db_client_cert.cert
}

# =============================================================================

resource "google_secret_manager_secret" "app_db_instance_client_cert_private_key" {
  secret_id  = "app-db-instance-client-cert-private-key"
  depends_on = [google_project_service.enable_secret_manager]

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "app_db_instance_client_cert_private_key" {
  secret      = google_secret_manager_secret.app_db_instance_client_cert_private_key.id
  secret_data = google_sql_ssl_cert.app_db_client_cert.private_key
}

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
