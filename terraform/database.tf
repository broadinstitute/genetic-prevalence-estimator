resource "google_compute_global_address" "db_private_ip_address" {
  name          = "app-db-address"
  network       = google_compute_network.app_network.id
  purpose       = "VPC_PEERING"
  address       = "172.16.0.0"
  address_type  = "INTERNAL"
  prefix_length = 16
}

resource "google_service_networking_connection" "db_private_vpc_connection" {
  network                 = google_compute_network.app_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.db_private_ip_address.name]
  depends_on              = [google_project_service.enable_service_networking]
}

resource "google_sql_database_instance" "app_db_instance" {
  name             = "app"
  database_version = "POSTGRES_13"
  region           = var.gcp_region

  depends_on = [
    google_project_service.enable_cloud_sql,
    google_service_networking_connection.db_private_vpc_connection,
  ]

  settings {
    availability_type = "ZONAL"
    disk_autoresize   = false
    disk_size         = 10
    disk_type         = "PD_HDD"
    tier              = "db-f1-micro"

    backup_configuration {
      enabled    = true
      start_time = "06:00"
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.app_network.id
      require_ssl     = true
    }

    maintenance_window {
      day          = 6
      hour         = 6
      update_track = "stable"
    }
  }
}

resource "google_sql_database" "app_db" {
  name     = "aggregate-frequency-calculator"
  instance = google_sql_database_instance.app_db_instance.name
}

resource "google_sql_user" "app_db_user" {
  name     = "calculator"
  password = random_password.app_db_user_password.result
  instance = google_sql_database_instance.app_db_instance.name
}

resource "random_password" "app_db_user_password" {
  length  = 24
  special = true
}

resource "google_sql_ssl_cert" "app_db_client_cert" {
  common_name = "app"
  instance    = google_sql_database_instance.app_db_instance.name
}
