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

resource "google_cloudbuild_trigger" "run_import_gnomad_v2_data_pipeline" {
  name        = "import-gnomad-v2"
  description = "Import gnomAD v2 data"

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
    logs_bucket = "gs://${google_storage_bucket.build_logs_bucket.name}/data-pipelines/import-gnomad-v2"
    timeout     = "10800s"

    options {
      logging = "GCS_ONLY"
    }

    substitutions = {
      _HAIL_VERSION = local.data_pipelines_default_hail_version
    }

    step {
      id         = "start-cluster"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "clusters",
        "create",
        "import-gnomad-$BUILD_ID",
        # Options set by hailctl
        "--image-version=2.0.29-debian10",
        "--properties=^|||^spark:spark.task.maxFailures=20|||spark:spark.driver.extraJavaOptions=-Xss4M|||spark:spark.executor.extraJavaOptions=-Xss4M|||spark:spark.speculation=true|||hdfs:dfs.replication=1|||dataproc:dataproc.logging.stackdriver.enable=false|||dataproc:dataproc.monitoring.stackdriver.enable=false|||spark:spark.driver.memory=41g|||yarn:yarn.nodemanager.resource.memory-mb=29184|||yarn:yarn.scheduler.maximum-allocation-mb=14592|||spark:spark.executor.cores=4|||spark:spark.executor.memory=5837m|||spark:spark.executor.memoryOverhead=8755m|||spark:spark.memory.storageFraction=0.2|||spark:spark.executorEnv.HAIL_WORKER_OFF_HEAP_MEMORY_PER_CORE_MB=2188",
        "--initialization-actions=gs://hail-common/hailctl/dataproc/0.2.83/init_notebook.py",
        "--metadata=^|||^WHEEL=gs://hail-common/hailctl/dataproc/0.2.83/hail-0.2.83-py3-none-any.whl|||PKGS=aiohttp==3.7.4|aiohttp_session>=2.7,<2.8|asyncinit>=0.2.4,<0.3|avro>=1.10,<1.11|azure-identity==1.6.0|azure-storage-blob==12.8.1|bokeh>1.3,<2.0|boto3>=1.17,<2.0|botocore>=1.20,<2.0|decorator<5|Deprecated>=1.2.10,<1.3|dill>=0.3.1.1,<0.4|gcsfs==2021.*|google-auth==1.27.0|google-cloud-storage==1.25.*|humanize==1.0.0|hurry.filesize==0.9|janus>=0.6,<0.7|nest_asyncio==1.5.4|numpy<2|orjson==3.6.4|pandas>=1.3.0,<1.4.0|parsimonious<0.9|plotly>=5.5.0,<5.6|PyJWT|python-json-logger==0.1.11|requests==2.25.1|scipy>1.2,<1.8|sortedcontainers==2.1.0|tabulate==0.8.3|tqdm==4.*|uvloop==0.16.0",
        "--master-machine-type=n1-highmem-8",
        "--master-boot-disk-size=100GB",
        "--num-master-local-ssds=0",
        "--num-worker-local-ssds=0",
        "--num-workers=16",
        "--secondary-worker-boot-disk-size=40GB",
        "--worker-boot-disk-size=40GB",
        "--worker-machine-type=n1-standard-8",
        "--initialization-action-timeout=20m",
        # Additional options
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "--subnet=${google_compute_subnetwork.dataproc_subnet.id}",
        "--service-account=${google_service_account.data_pipeline.email}",
        "--no-address",
        "--tags=dataproc",
        "--max-age=3h",
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
        "--cluster=import-gnomad-$BUILD_ID",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/prepare_gnomad_variants.py",
        "--",
        "--quiet",
        "--gnomad-version=2",
        "--partitions=40000",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v2.1.1_variants.ht",
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
        "import-gnomad-$BUILD_ID",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
      ]
    }
  }
}

resource "google_cloudbuild_trigger" "run_import_gnomad_v3_data_pipeline" {
  name        = "import-gnomad-v3"
  description = "Import gnomAD v3 data"

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
    logs_bucket = "gs://${google_storage_bucket.build_logs_bucket.name}/data-pipelines/import-gnomad-v3"
    timeout     = "10800s"

    options {
      logging = "GCS_ONLY"
    }

    substitutions = {
      _HAIL_VERSION = local.data_pipelines_default_hail_version
    }

    step {
      id         = "start-cluster"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "clusters",
        "create",
        "import-gnomad-$BUILD_ID",
        # Options set by hailctl
        "--image-version=2.0.29-debian10",
        "--properties=^|||^spark:spark.task.maxFailures=20|||spark:spark.driver.extraJavaOptions=-Xss4M|||spark:spark.executor.extraJavaOptions=-Xss4M|||spark:spark.speculation=true|||hdfs:dfs.replication=1|||dataproc:dataproc.logging.stackdriver.enable=false|||dataproc:dataproc.monitoring.stackdriver.enable=false|||spark:spark.driver.memory=41g|||yarn:yarn.nodemanager.resource.memory-mb=29184|||yarn:yarn.scheduler.maximum-allocation-mb=14592|||spark:spark.executor.cores=4|||spark:spark.executor.memory=5837m|||spark:spark.executor.memoryOverhead=8755m|||spark:spark.memory.storageFraction=0.2|||spark:spark.executorEnv.HAIL_WORKER_OFF_HEAP_MEMORY_PER_CORE_MB=2188",
        "--initialization-actions=gs://hail-common/hailctl/dataproc/0.2.83/init_notebook.py",
        "--metadata=^|||^WHEEL=gs://hail-common/hailctl/dataproc/0.2.83/hail-0.2.83-py3-none-any.whl|||PKGS=aiohttp==3.7.4|aiohttp_session>=2.7,<2.8|asyncinit>=0.2.4,<0.3|avro>=1.10,<1.11|azure-identity==1.6.0|azure-storage-blob==12.8.1|bokeh>1.3,<2.0|boto3>=1.17,<2.0|botocore>=1.20,<2.0|decorator<5|Deprecated>=1.2.10,<1.3|dill>=0.3.1.1,<0.4|gcsfs==2021.*|google-auth==1.27.0|google-cloud-storage==1.25.*|humanize==1.0.0|hurry.filesize==0.9|janus>=0.6,<0.7|nest_asyncio==1.5.4|numpy<2|orjson==3.6.4|pandas>=1.3.0,<1.4.0|parsimonious<0.9|plotly>=5.5.0,<5.6|PyJWT|python-json-logger==0.1.11|requests==2.25.1|scipy>1.2,<1.8|sortedcontainers==2.1.0|tabulate==0.8.3|tqdm==4.*|uvloop==0.16.0",
        "--master-machine-type=n1-highmem-8",
        "--master-boot-disk-size=100GB",
        "--num-master-local-ssds=0",
        "--num-worker-local-ssds=0",
        "--num-workers=16",
        "--secondary-worker-boot-disk-size=40GB",
        "--worker-boot-disk-size=40GB",
        "--worker-machine-type=n1-standard-8",
        "--initialization-action-timeout=20m",
        # Additional options
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "--subnet=${google_compute_subnetwork.dataproc_subnet.id}",
        "--service-account=${google_service_account.data_pipeline.email}",
        "--no-address",
        "--tags=dataproc",
        "--max-age=3h",
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
        "--cluster=import-gnomad-$BUILD_ID",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/prepare_gnomad_variants.py",
        "--",
        "--quiet",
        "--gnomad-version=3",
        "--partitions=100000",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v3.1.2_variants.ht",
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
        "import-gnomad-$BUILD_ID",
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
      logging = "GCS_ONLY"
    }

    substitutions = {
      _HAIL_VERSION = local.data_pipelines_default_hail_version
    }

    step {
      id         = "start-cluster"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "clusters",
        "create",
        "import-clinvar-$BUILD_ID",
        # Options set by hailctl
        "--image-version=2.0.29-debian10",
        "--properties=^|||^spark:spark.task.maxFailures=20|||spark:spark.driver.extraJavaOptions=-Xss4M|||spark:spark.executor.extraJavaOptions=-Xss4M|||spark:spark.speculation=true|||hdfs:dfs.replication=1|||dataproc:dataproc.logging.stackdriver.enable=false|||dataproc:dataproc.monitoring.stackdriver.enable=false|||spark:spark.driver.memory=41g|||yarn:yarn.nodemanager.resource.memory-mb=29184|||yarn:yarn.scheduler.maximum-allocation-mb=14592|||spark:spark.executor.cores=4|||spark:spark.executor.memory=5837m|||spark:spark.executor.memoryOverhead=8755m|||spark:spark.memory.storageFraction=0.2|||spark:spark.executorEnv.HAIL_WORKER_OFF_HEAP_MEMORY_PER_CORE_MB=2188",
        "--initialization-actions=gs://hail-common/hailctl/dataproc/0.2.83/init_notebook.py",
        "--metadata=^|||^WHEEL=gs://hail-common/hailctl/dataproc/0.2.83/hail-0.2.83-py3-none-any.whl|||PKGS=aiohttp==3.7.4|aiohttp_session>=2.7,<2.8|asyncinit>=0.2.4,<0.3|avro>=1.10,<1.11|azure-identity==1.6.0|azure-storage-blob==12.8.1|bokeh>1.3,<2.0|boto3>=1.17,<2.0|botocore>=1.20,<2.0|decorator<5|Deprecated>=1.2.10,<1.3|dill>=0.3.1.1,<0.4|gcsfs==2021.*|google-auth==1.27.0|google-cloud-storage==1.25.*|humanize==1.0.0|hurry.filesize==0.9|janus>=0.6,<0.7|nest_asyncio==1.5.4|numpy<2|orjson==3.6.4|pandas>=1.3.0,<1.4.0|parsimonious<0.9|plotly>=5.5.0,<5.6|PyJWT|python-json-logger==0.1.11|requests==2.25.1|scipy>1.2,<1.8|sortedcontainers==2.1.0|tabulate==0.8.3|tqdm==4.*|uvloop==0.16.0",
        "--master-machine-type=n1-highmem-8",
        "--master-boot-disk-size=100GB",
        "--num-master-local-ssds=0",
        "--num-secondary-workers=0",
        "--num-worker-local-ssds=0",
        "--num-workers=2",
        "--secondary-worker-boot-disk-size=40GB",
        "--worker-boot-disk-size=40GB",
        "--worker-machine-type=n1-standard-8",
        "--initialization-action-timeout=20m",
        # Additional options
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
        "--cluster=import-clinvar-$BUILD_ID",
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
        "--cluster=import-clinvar-$BUILD_ID",
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
        "import-clinvar-$BUILD_ID",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
      ]
    }
  }
}
