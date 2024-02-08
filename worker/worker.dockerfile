###############################################################################
# Base image
###############################################################################
FROM python:3.9-slim as base

RUN useradd --create-home app

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install dependencies
RUN apt-get -qq update && \
  apt-get -qq install gnupg software-properties-common wget && \
  apt install -y wget apt-transport-https && \
  mkdir -p /etc/apt/keyrings && \
  wget -O - https://packages.adoptium.net/artifactory/api/gpg/key/public | tee /etc/apt/keyrings/adoptium.asc && \
  echo "deb [signed-by=/etc/apt/keyrings/adoptium.asc] https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" | tee /etc/apt/sources.list.d/adoptium.list && \
  apt update && \
  apt install -y temurin-8-jdk && \
  rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir gunicorn==20.1.0 psycopg2-binary==2.9.3

COPY worker/worker-requirements.txt ./worker/worker-requirements.txt
RUN pip install --no-cache-dir -r ./worker/worker-requirements.txt
# Can't add google-cloud-logging to requirements.txt because Hail pins protobuf to an old version
# and google-cloud-logging requires a newer version.
RUN pip install --no-cache-dir google-cloud-logging

COPY shared-requirements.txt ./shared-requirements.txt
RUN pip install --no-cache-dir -r ./shared-requirements.txt

# Install and configure GCS connector
# https://github.com/GoogleCloudDataproc/hadoop-connectors/blob/branch-2.2.x/gcs/CONFIGURATION.md#authentication
RUN export SPARK_HOME=$(find_spark_home.py) && \
    wget -O $SPARK_HOME/jars/gcs-connector-hadoop2-2.2.5.jar \
      https://storage.googleapis.com/hadoop-lib/gcs/gcs-connector-hadoop2-2.2.5.jar && \
    mkdir -p $SPARK_HOME/conf && \
    touch $SPARK_HOME/conf/spark-defaults.conf && \
    echo "spark.hadoop.google.cloud.auth.service.account.enable true" >> $SPARK_HOME/conf/spark-defaults.conf

# Copy code
COPY calculator ./calculator
RUN pip install --no-cache-dir -e calculator

COPY worker ./worker
RUN pip install --no-cache-dir -e worker

# Run as app user
RUN chown -R app .
USER app

# Run
ENV DJANGO_SETTINGS_MODULE=worker.settings.base

CMD exec gunicorn --bind :$PORT --log-file - --workers 1 --threads 8 --timeout 120 --preload worker.wsgi
