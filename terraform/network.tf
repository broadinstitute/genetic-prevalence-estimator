resource "google_compute_network" "app_network" {
  name                    = "app-network"
  auto_create_subnetworks = false
}
