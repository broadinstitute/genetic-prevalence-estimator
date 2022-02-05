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
  depends_on              = [google_project_service.service_networking]
}

resource "google_compute_subnetwork" "dataproc_subnet" {
  name                     = "dataproc"
  network                  = google_compute_network.app_network.id
  region                   = var.gcp_region
  ip_cidr_range            = "192.168.255.0/24"
  private_ip_google_access = true
}

resource "google_compute_firewall" "app_network_dataproc_internal" {
  name        = "app-network-dataproc-internal"
  network     = google_compute_network.app_network.id
  description = "Allow communication between nodes in Dataproc clusters"

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_tags = ["dataproc"]
  target_tags = ["dataproc"]
}

resource "google_compute_router" "app_network_nat_router" {
  name    = "app-network-nat-router"
  region  = var.gcp_region
  network = google_compute_network.app_network.id
}

resource "google_compute_router_nat" "app_network_nat" {
  name                               = "app-network-nat"
  router                             = google_compute_router.app_network_nat_router.name
  region                             = google_compute_router.app_network_nat_router.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
