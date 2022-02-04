resource "google_compute_network" "app_network" {
  name                    = "app-network"
  auto_create_subnetworks = false
}

resource "google_compute_global_address" "private_services_address_range" {
  name          = "app-db-address"
  network       = google_compute_network.app_network.id
  purpose       = "VPC_PEERING"
  address       = "172.16.0.0"
  address_type  = "INTERNAL"
  prefix_length = 16
}

resource "google_service_networking_connection" "private_services_connection" {
  network                 = google_compute_network.app_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services_address_range.name]
  depends_on              = [google_project_service.enable_service_networking]
}
