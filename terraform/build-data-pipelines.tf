resource "google_service_account" "data_pipeline_runner" {
  account_id  = "data-pipeline-runner"
  description = "Used by Cloud Build to run data pipelines"
}

resource "google_storage_bucket_iam_member" "data_pipeline_runner_build_logs_storage_admin" {
  bucket = google_storage_bucket.build_logs_bucket.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.data_pipeline_runner.email}"
}

resource "google_project_iam_member" "data_pipeline_runner_dataproc_editor" {
  project = data.google_project.project.id
  role    = "roles/dataproc.editor"
  member  = "serviceAccount:${google_service_account.data_pipeline_runner.email}"
}

resource "google_project_iam_member" "data_pipeline_runner_storage_object_creator" {
  project = data.google_project.project.id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.data_pipeline_runner.email}"
}

resource "google_project_iam_member" "data_pipeline_runner_storage_object_viewer" {
  project = data.google_project.project.id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.data_pipeline_runner.email}"
}

resource "google_service_account_iam_member" "data_pipeline_runner_act_as_data_pipeline" {
  service_account_id = google_service_account.data_pipeline.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.data_pipeline_runner.email}"
}

locals {
  data_pipelines_default_hail_version = "0.2.83"
}

resource "google_cloudbuild_trigger" "run_import_gnomad_data_pipeline" {
  name        = "import-gnomad"
  description = "Import gnomAD data"

  github {
    owner = split("/", var.github_repository)[0]
    name  = split("/", var.github_repository)[1]

    push {
      branch = "^main$"
    }
  }

  # Workaround to create a manual trigger
  ignored_files = ["**/*"]

  service_account = google_service_account.data_pipeline_runner.id

  depends_on = [
    google_storage_bucket_iam_member.data_pipeline_runner_build_logs_storage_admin,
    google_project_iam_member.data_pipeline_runner_dataproc_editor,
    google_project_iam_member.data_pipeline_runner_storage_object_creator,
    google_project_iam_member.data_pipeline_runner_storage_object_viewer,
    google_service_account_iam_member.data_pipeline_runner_act_as_data_pipeline,
  ]

  build {
    logs_bucket = "gs://${google_storage_bucket.build_logs_bucket.name}/data-pipelines/import-gnomad"
    timeout     = "10800s"

    options {
      dynamic_substitutions = true
      logging               = "GCS_ONLY"
    }

    substitutions = {
      _CLUSTER_NAME = "import-gnomad-$BUILD_ID"
      _HAIL_VERSION = local.data_pipelines_default_hail_version
    }

    step {
      id   = "start-cluster"
      name = "hailgenetics/hail:$_HAIL_VERSION"
      args = [
        "hailctl",
        "dataproc",
        "start",
        "$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "--subnet=${google_compute_subnetwork.dataproc_subnet.id}",
        "--service-account=${google_service_account.data_pipeline.email}",
        "--no-address",
        "--tags=dataproc",
        "--max-age=3h",
        "--num-secondary-workers=16",
      ]
    }

    step {
      id         = "prepare-gnomad-v2-variants"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "jobs",
        "submit",
        "pyspark",
        "--cluster=$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/prepare_gnomad_variants.py",
        "--",
        "--quiet",
        "--gnomad-version=2",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v2.1.1_variants.ht",
      ]
    }

    step {
      id         = "prepare-gnomad-v2-transcript-variant-lists"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "jobs",
        "submit",
        "pyspark",
        "--cluster=$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/prepare_transcript_variant_lists.py",
        "--",
        "--quiet",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v2.1.1_variants.ht",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v2.1.1_transcript_variant_lists.ht",
      ]
    }

    step {
      id         = "prepare-gnomad-v3-variants"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "jobs",
        "submit",
        "pyspark",
        "--cluster=$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/prepare_gnomad_variants.py",
        "--",
        "--quiet",
        "--gnomad-version=3",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v3.1.2_variants.ht",
      ]
    }

    step {
      id         = "prepare-gnomad-v3-transcript-variant-lists"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "jobs",
        "submit",
        "pyspark",
        "--cluster=$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/prepare_transcript_variant_lists.py",
        "--",
        "--quiet",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v3.1.2_variants.ht",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v3.1.2_transcript_variant_lists.ht",
      ]
    }

    step {
      id         = "stop-cluster"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "clusters",
        "delete",
        "--quiet",
        "$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
      ]
    }
  }
}

resource "google_cloudbuild_trigger" "run_import_clinvar_data_pipeline" {
  name        = "import-clinvar"
  description = "Import ClinVar data"

  github {
    owner = split("/", var.github_repository)[0]
    name  = split("/", var.github_repository)[1]

    push {
      branch = "^main$"
    }
  }

  # Workaround to create a manual trigger
  ignored_files = ["**/*"]

  service_account = google_service_account.data_pipeline_runner.id

  depends_on = [
    google_storage_bucket_iam_member.data_pipeline_runner_build_logs_storage_admin,
    google_project_iam_member.data_pipeline_runner_dataproc_editor,
    google_project_iam_member.data_pipeline_runner_storage_object_creator,
    google_project_iam_member.data_pipeline_runner_storage_object_viewer,
    google_service_account_iam_member.data_pipeline_runner_act_as_data_pipeline,
  ]

  build {
    logs_bucket = "gs://${google_storage_bucket.build_logs_bucket.name}/data-pipelines/import-clinvar"
    timeout     = "3600s"

    options {
      dynamic_substitutions = true
      logging               = "GCS_ONLY"
    }

    substitutions = {
      _CLUSTER_NAME = "import-clinvar-$BUILD_ID"
      _HAIL_VERSION = local.data_pipelines_default_hail_version
    }

    step {
      id   = "start-cluster"
      name = "hailgenetics/hail:$_HAIL_VERSION"
      args = [
        "hailctl",
        "dataproc",
        "start",
        "$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "--subnet=${google_compute_subnetwork.dataproc_subnet.id}",
        "--service-account=${google_service_account.data_pipeline.email}",
        "--no-address",
        "--tags=dataproc",
        "--max-age=1h",
      ]
    }

    step {
      id         = "import-clinvar-grch37"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "jobs",
        "submit",
        "pyspark",
        "--cluster=$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/import_clinvar.py",
        "--",
        "--quiet",
        "--reference-genome=GRCh37",
        "gs://${google_storage_bucket.data_bucket.name}/ClinVar/ClinVar_GRCh37_variants.ht",
      ]
    }

    step {
      id         = "import-clinvar-grch38"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "jobs",
        "submit",
        "pyspark",
        "--cluster=$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/import_clinvar.py",
        "--",
        "--quiet",
        "--reference-genome=GRCh38",
        "gs://${google_storage_bucket.data_bucket.name}/ClinVar/ClinVar_GRCh38_variants.ht",
      ]
    }

    step {
      id         = "stop-cluster"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "clusters",
        "delete",
        "--quiet",
        "$_CLUSTER_NAME",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
      ]
    }
  }
}
