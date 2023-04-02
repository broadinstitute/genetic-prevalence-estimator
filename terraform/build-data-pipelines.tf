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
  data_pipelines_default_hail_version = "0.2.112"
}

resource "google_cloudbuild_trigger" "run_import_gnomad_v2_data_pipeline" {
  name        = "import-gnomad-v2"
  description = "Import gnomAD v2 data"

  source_to_build {
    uri       = "https://github.com/${var.github_repository}"
    ref       = "refs/head/main"
    repo_type = "GITHUB"
  }

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
        "--image-version=2.1.2-debian11",
        "--properties=^|||^spark:spark.task.maxFailures=20|||spark:spark.driver.extraJavaOptions=-Xss4M|||spark:spark.executor.extraJavaOptions=-Xss4M|||spark:spark.speculation=true|||hdfs:dfs.replication=1|||dataproc:dataproc.logging.stackdriver.enable=false|||dataproc:dataproc.monitoring.stackdriver.enable=false|||spark:spark.driver.memory=41g|||yarn:yarn.nodemanager.resource.memory-mb=29184|||yarn:yarn.scheduler.maximum-allocation-mb=14592|||spark:spark.executor.cores=4|||spark:spark.executor.memory=5837m|||spark:spark.executor.memoryOverhead=8755m|||spark:spark.memory.storageFraction=0.2|||spark:spark.executorEnv.HAIL_WORKER_OFF_HEAP_MEMORY_PER_CORE_MB=3648",
        "--initialization-actions=gs://hail-common/hailctl/dataproc/0.2.112/init_notebook.py",
        "--metadata=^|||^WHEEL=gs://hail-common/hailctl/dataproc/0.2.112/hail-0.2.112-py3-none-any.whl|||PKGS=aiohttp==3.8.4|aiohttp-session==2.12.0|aiosignal==1.3.1|async-timeout==4.0.2|asyncinit==0.2.4|asynctest==0.13.0|attrs==22.2.0|avro==1.11.1|azure-core==1.26.3|azure-identity==1.12.0|azure-storage-blob==12.14.1|bokeh==1.4.0|boto3==1.26.73|botocore==1.29.73|cachetools==5.3.0|certifi==2022.12.7|cffi==1.15.1|charset-normalizer==3.0.1|commonmark==0.9.1|cryptography==39.0.1|decorator==4.4.2|deprecated==1.2.13|dill==0.3.6|frozenlist==1.3.3|google-api-core==2.11.0|google-auth==2.14.1|google-cloud-core==2.3.2|google-cloud-storage==2.7.0|google-crc32c==1.5.0|google-resumable-media==2.4.1|googleapis-common-protos==1.58.0|humanize==1.1.0|hurry-filesize==0.9|idna==3.4|isodate==0.6.1|janus==1.0.0|jinja2==3.0.3|jmespath==1.0.1|markupsafe==2.1.2|msal==1.21.0|msal-extensions==1.0.0|msrest==0.7.1|multidict==6.0.4|nest-asyncio==1.5.6|numpy==1.21.6|oauthlib==3.2.2|orjson==3.8.6|packaging==23.0|pandas==1.3.5|parsimonious==0.8.1|pillow==9.4.0|plotly==5.10.0|portalocker==2.7.0|protobuf==3.20.2|py4j==0.10.9.5|pyasn1==0.4.8|pyasn1-modules==0.2.8|pycparser==2.21|pygments==2.14.0|pyjwt[crypto]==2.6.0|python-dateutil==2.8.2|python-json-logger==2.0.6|pytz==2022.7.1|pyyaml==6.0|requests==2.28.2|requests-oauthlib==1.3.1|rich==12.6.0|rsa==4.9|s3transfer==0.6.0|scipy==1.7.3|six==1.16.0|sortedcontainers==2.4.0|tabulate==0.9.0|tenacity==8.2.1|tornado==6.2|typing-extensions==4.5.0|urllib3==1.26.14|uvloop==0.17.0;sys_platform!=\"win32\"|wrapt==1.14.1|yarl==1.8.2",
        "--master-machine-type=n1-highmem-8",
        "--master-boot-disk-size=100GB",
        "--num-master-local-ssds=0",
        "--num-secondary-workers=0",
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
        "--max-idle=5m",
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

  source_to_build {
    uri       = "https://github.com/${var.github_repository}"
    ref       = "refs/head/main"
    repo_type = "GITHUB"
  }

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
        "--image-version=2.1.2-debian11",
        "--properties=^|||^spark:spark.task.maxFailures=20|||spark:spark.driver.extraJavaOptions=-Xss4M|||spark:spark.executor.extraJavaOptions=-Xss4M|||spark:spark.speculation=true|||hdfs:dfs.replication=1|||dataproc:dataproc.logging.stackdriver.enable=false|||dataproc:dataproc.monitoring.stackdriver.enable=false|||spark:spark.driver.memory=41g|||yarn:yarn.nodemanager.resource.memory-mb=29184|||yarn:yarn.scheduler.maximum-allocation-mb=14592|||spark:spark.executor.cores=4|||spark:spark.executor.memory=5837m|||spark:spark.executor.memoryOverhead=8755m|||spark:spark.memory.storageFraction=0.2|||spark:spark.executorEnv.HAIL_WORKER_OFF_HEAP_MEMORY_PER_CORE_MB=3648",
        "--initialization-actions=gs://hail-common/hailctl/dataproc/0.2.112/init_notebook.py",
        "--metadata=^|||^WHEEL=gs://hail-common/hailctl/dataproc/0.2.112/hail-0.2.112-py3-none-any.whl|||PKGS=aiohttp==3.8.4|aiohttp-session==2.12.0|aiosignal==1.3.1|async-timeout==4.0.2|asyncinit==0.2.4|asynctest==0.13.0|attrs==22.2.0|avro==1.11.1|azure-core==1.26.3|azure-identity==1.12.0|azure-storage-blob==12.14.1|bokeh==1.4.0|boto3==1.26.73|botocore==1.29.73|cachetools==5.3.0|certifi==2022.12.7|cffi==1.15.1|charset-normalizer==3.0.1|commonmark==0.9.1|cryptography==39.0.1|decorator==4.4.2|deprecated==1.2.13|dill==0.3.6|frozenlist==1.3.3|google-api-core==2.11.0|google-auth==2.14.1|google-cloud-core==2.3.2|google-cloud-storage==2.7.0|google-crc32c==1.5.0|google-resumable-media==2.4.1|googleapis-common-protos==1.58.0|humanize==1.1.0|hurry-filesize==0.9|idna==3.4|isodate==0.6.1|janus==1.0.0|jinja2==3.0.3|jmespath==1.0.1|markupsafe==2.1.2|msal==1.21.0|msal-extensions==1.0.0|msrest==0.7.1|multidict==6.0.4|nest-asyncio==1.5.6|numpy==1.21.6|oauthlib==3.2.2|orjson==3.8.6|packaging==23.0|pandas==1.3.5|parsimonious==0.8.1|pillow==9.4.0|plotly==5.10.0|portalocker==2.7.0|protobuf==3.20.2|py4j==0.10.9.5|pyasn1==0.4.8|pyasn1-modules==0.2.8|pycparser==2.21|pygments==2.14.0|pyjwt[crypto]==2.6.0|python-dateutil==2.8.2|python-json-logger==2.0.6|pytz==2022.7.1|pyyaml==6.0|requests==2.28.2|requests-oauthlib==1.3.1|rich==12.6.0|rsa==4.9|s3transfer==0.6.0|scipy==1.7.3|six==1.16.0|sortedcontainers==2.4.0|tabulate==0.9.0|tenacity==8.2.1|tornado==6.2|typing-extensions==4.5.0|urllib3==1.26.14|uvloop==0.17.0;sys_platform!=\"win32\"|wrapt==1.14.1|yarl==1.8.2",
        "--master-machine-type=n1-highmem-8",
        "--master-boot-disk-size=100GB",
        "--num-master-local-ssds=0",
        "--num-secondary-workers=0",
        "--num-worker-local-ssds=0",
        "--num-workers=32",
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
        "--max-idle=5m",
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

resource "google_cloudbuild_trigger" "run_import_lof_curation_results_data_pipeline" {
  name        = "import-lof-curation-results"
  description = "Import LoF curation results"

  source_to_build {
    uri       = "https://github.com/${var.github_repository}"
    ref       = "refs/head/main"
    repo_type = "GITHUB"
  }

  service_account = google_service_account.data_pipeline_runner.id

  depends_on = [
    google_storage_bucket_iam_member.data_pipeline_runner_build_logs_storage_admin,
    google_project_iam_member.data_pipeline_runner_dataproc_editor,
    google_project_iam_member.data_pipeline_runner_storage_object_creator,
    google_project_iam_member.data_pipeline_runner_storage_object_viewer,
    google_service_account_iam_member.data_pipeline_runner_act_as_data_pipeline,
  ]

  build {
    logs_bucket = "gs://${google_storage_bucket.build_logs_bucket.name}/data-pipelines/import-lof-curation-results"
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
        "import-lof-$BUILD_ID",
        # Options set by hailctl
        "--image-version=2.1.2-debian11",
        "--properties=^|||^spark:spark.task.maxFailures=20|||spark:spark.driver.extraJavaOptions=-Xss4M|||spark:spark.executor.extraJavaOptions=-Xss4M|||spark:spark.speculation=true|||hdfs:dfs.replication=1|||dataproc:dataproc.logging.stackdriver.enable=false|||dataproc:dataproc.monitoring.stackdriver.enable=false|||spark:spark.driver.memory=41g|||yarn:yarn.nodemanager.resource.memory-mb=29184|||yarn:yarn.scheduler.maximum-allocation-mb=14592|||spark:spark.executor.cores=4|||spark:spark.executor.memory=5837m|||spark:spark.executor.memoryOverhead=8755m|||spark:spark.memory.storageFraction=0.2|||spark:spark.executorEnv.HAIL_WORKER_OFF_HEAP_MEMORY_PER_CORE_MB=3648",
        "--initialization-actions=gs://hail-common/hailctl/dataproc/0.2.112/init_notebook.py",
        "--metadata=^|||^WHEEL=gs://hail-common/hailctl/dataproc/0.2.112/hail-0.2.112-py3-none-any.whl|||PKGS=aiohttp==3.8.4|aiohttp-session==2.12.0|aiosignal==1.3.1|async-timeout==4.0.2|asyncinit==0.2.4|asynctest==0.13.0|attrs==22.2.0|avro==1.11.1|azure-core==1.26.3|azure-identity==1.12.0|azure-storage-blob==12.14.1|bokeh==1.4.0|boto3==1.26.73|botocore==1.29.73|cachetools==5.3.0|certifi==2022.12.7|cffi==1.15.1|charset-normalizer==3.0.1|commonmark==0.9.1|cryptography==39.0.1|decorator==4.4.2|deprecated==1.2.13|dill==0.3.6|frozenlist==1.3.3|google-api-core==2.11.0|google-auth==2.14.1|google-cloud-core==2.3.2|google-cloud-storage==2.7.0|google-crc32c==1.5.0|google-resumable-media==2.4.1|googleapis-common-protos==1.58.0|humanize==1.1.0|hurry-filesize==0.9|idna==3.4|isodate==0.6.1|janus==1.0.0|jinja2==3.0.3|jmespath==1.0.1|markupsafe==2.1.2|msal==1.21.0|msal-extensions==1.0.0|msrest==0.7.1|multidict==6.0.4|nest-asyncio==1.5.6|numpy==1.21.6|oauthlib==3.2.2|orjson==3.8.6|packaging==23.0|pandas==1.3.5|parsimonious==0.8.1|pillow==9.4.0|plotly==5.10.0|portalocker==2.7.0|protobuf==3.20.2|py4j==0.10.9.5|pyasn1==0.4.8|pyasn1-modules==0.2.8|pycparser==2.21|pygments==2.14.0|pyjwt[crypto]==2.6.0|python-dateutil==2.8.2|python-json-logger==2.0.6|pytz==2022.7.1|pyyaml==6.0|requests==2.28.2|requests-oauthlib==1.3.1|rich==12.6.0|rsa==4.9|s3transfer==0.6.0|scipy==1.7.3|six==1.16.0|sortedcontainers==2.4.0|tabulate==0.9.0|tenacity==8.2.1|tornado==6.2|typing-extensions==4.5.0|urllib3==1.26.14|uvloop==0.17.0;sys_platform!=\"win32\"|wrapt==1.14.1|yarl==1.8.2",
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
        "--max-idle=5m",
        "--max-age=1h",
      ]
    }

    step {
      id         = "import-gnomad-v2-lof-curation-results"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk"
      entrypoint = "gcloud"
      args = [
        "dataproc",
        "jobs",
        "submit",
        "pyspark",
        "--cluster=import-lof-$BUILD_ID",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
        "./data-pipelines/import_lof_curation_results.py",
        "--",
        "--quiet",
        "--gnomad-version=2",
        "gs://${google_storage_bucket.data_bucket.name}/gnomAD/gnomAD_v2.1.1_lof_curation_results.ht",
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
        "import-lof-$BUILD_ID",
        "--region=${google_compute_subnetwork.dataproc_subnet.region}",
      ]
    }
  }
}

resource "google_cloudbuild_trigger" "run_import_clinvar_data_pipeline" {
  name        = "import-clinvar"
  description = "Import ClinVar data"

  source_to_build {
    uri       = "https://github.com/${var.github_repository}"
    ref       = "refs/head/main"
    repo_type = "GITHUB"
  }

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
        "--image-version=2.1.2-debian11",
        "--properties=^|||^spark:spark.task.maxFailures=20|||spark:spark.driver.extraJavaOptions=-Xss4M|||spark:spark.executor.extraJavaOptions=-Xss4M|||spark:spark.speculation=true|||hdfs:dfs.replication=1|||dataproc:dataproc.logging.stackdriver.enable=false|||dataproc:dataproc.monitoring.stackdriver.enable=false|||spark:spark.driver.memory=41g|||yarn:yarn.nodemanager.resource.memory-mb=29184|||yarn:yarn.scheduler.maximum-allocation-mb=14592|||spark:spark.executor.cores=4|||spark:spark.executor.memory=5837m|||spark:spark.executor.memoryOverhead=8755m|||spark:spark.memory.storageFraction=0.2|||spark:spark.executorEnv.HAIL_WORKER_OFF_HEAP_MEMORY_PER_CORE_MB=3648",
        "--initialization-actions=gs://hail-common/hailctl/dataproc/0.2.112/init_notebook.py",
        "--metadata=^|||^WHEEL=gs://hail-common/hailctl/dataproc/0.2.112/hail-0.2.112-py3-none-any.whl|||PKGS=aiohttp==3.8.4|aiohttp-session==2.12.0|aiosignal==1.3.1|async-timeout==4.0.2|asyncinit==0.2.4|asynctest==0.13.0|attrs==22.2.0|avro==1.11.1|azure-core==1.26.3|azure-identity==1.12.0|azure-storage-blob==12.14.1|bokeh==1.4.0|boto3==1.26.73|botocore==1.29.73|cachetools==5.3.0|certifi==2022.12.7|cffi==1.15.1|charset-normalizer==3.0.1|commonmark==0.9.1|cryptography==39.0.1|decorator==4.4.2|deprecated==1.2.13|dill==0.3.6|frozenlist==1.3.3|google-api-core==2.11.0|google-auth==2.14.1|google-cloud-core==2.3.2|google-cloud-storage==2.7.0|google-crc32c==1.5.0|google-resumable-media==2.4.1|googleapis-common-protos==1.58.0|humanize==1.1.0|hurry-filesize==0.9|idna==3.4|isodate==0.6.1|janus==1.0.0|jinja2==3.0.3|jmespath==1.0.1|markupsafe==2.1.2|msal==1.21.0|msal-extensions==1.0.0|msrest==0.7.1|multidict==6.0.4|nest-asyncio==1.5.6|numpy==1.21.6|oauthlib==3.2.2|orjson==3.8.6|packaging==23.0|pandas==1.3.5|parsimonious==0.8.1|pillow==9.4.0|plotly==5.10.0|portalocker==2.7.0|protobuf==3.20.2|py4j==0.10.9.5|pyasn1==0.4.8|pyasn1-modules==0.2.8|pycparser==2.21|pygments==2.14.0|pyjwt[crypto]==2.6.0|python-dateutil==2.8.2|python-json-logger==2.0.6|pytz==2022.7.1|pyyaml==6.0|requests==2.28.2|requests-oauthlib==1.3.1|rich==12.6.0|rsa==4.9|s3transfer==0.6.0|scipy==1.7.3|six==1.16.0|sortedcontainers==2.4.0|tabulate==0.9.0|tenacity==8.2.1|tornado==6.2|typing-extensions==4.5.0|urllib3==1.26.14|uvloop==0.17.0;sys_platform!=\"win32\"|wrapt==1.14.1|yarl==1.8.2",
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
        "--max-idle=5m",
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
