resource "google_compute_network" "app_network" {
  name                    = "app-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "app_subnet" {
  name          = "app-subnet"
  region        = var.gcp_region
  network       = google_compute_network.app_network.self_link
  ip_cidr_range = "10.0.0.0/24"
}
