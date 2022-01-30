resource "google_compute_network" "app_network" {
  name                    = "app-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "app_subnet" {
  name          = "app-subnet"
  region        = var.gcp_region
  network       = google_compute_network.app_network.self_link
  ip_cidr_range = "10.0.0.0/28"
}

resource "google_vpc_access_connector" "app_vpc_connector" {
  name     = "app-vpc-connector"
  provider = google-beta

  machine_type = "f1-micro"
  min_instances = 2
  max_instances = 3

  subnet {
    name = google_compute_subnetwork.app_subnet.name
  }
  depends_on = [google_project_service.enable_vpc_access]
}
