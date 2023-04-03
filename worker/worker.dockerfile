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
  wget -qO - https://adoptopenjdk.jfrog.io/adoptopenjdk/api/gpg/key/public | apt-key add - && \
  add-apt-repository --yes https://adoptopenjdk.jfrog.io/adoptopenjdk/deb/ && \
  apt-get -qq update && \
  mkdir -p /usr/share/man/man1 && \
  apt-get -qq install adoptopenjdk-8-hotspot && \
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

CMD exec gunicorn --bind :$PORT --log-file - --workers 1 --threads 8 worker.wsgi
