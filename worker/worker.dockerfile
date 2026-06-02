###############################################################################
# Base image
###############################################################################
FROM python:3.13-slim as base

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/

RUN useradd --create-home app

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_PROJECT_ENVIRONMENT="/opt/venv"

# Install dependencies
RUN apt-get -qq update && \
  apt-get -qq install -y gnupg wget apt-transport-https && \
  mkdir -p /etc/apt/keyrings && \
  wget -O - https://packages.adoptium.net/artifactory/api/gpg/key/public | tee /etc/apt/keyrings/adoptium.asc && \
  echo "deb [signed-by=/etc/apt/keyrings/adoptium.asc] https://packages.adoptium.net/artifactory/deb $(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main" | tee /etc/apt/sources.list.d/adoptium.list && \
  apt update && \
  apt install -y temurin-11-jdk && \
  rm -rf /var/lib/apt/lists/*

COPY uv.lock pyproject.toml ./
COPY worker/pyproject.toml ./worker/
COPY calculator/pyproject.toml ./calculator/

RUN uv sync --frozen --no-install-project --package worker

# ENV PATH="/app/.venv/bin:$PATH"
ENV PATH="/opt/venv/bin:$PATH"

# Install and configure GCS connector
# https://github.com/GoogleCloudDataproc/hadoop-connectors/blob/branch-2.2.x/gcs/CONFIGURATION.md#authentication
RUN export SPARK_HOME=$(find_spark_home.py) && \
    wget -O $SPARK_HOME/jars/gcs-connector-hadoop2-2.2.5.jar \
      https://storage.googleapis.com/hadoop-lib/gcs/gcs-connector-hadoop2-2.2.5.jar && \
    mkdir -p $SPARK_HOME/conf && \
    touch $SPARK_HOME/conf/spark-defaults.conf && \
    echo "spark.hadoop.google.cloud.auth.service.account.enable true" >> $SPARK_HOME/conf/spark-defaults.conf

# Copy backend code
COPY calculator ./calculator
RUN uv sync --frozen --package calculator

COPY worker ./worker
RUN uv sync --frozen --package worker

# Run as app user
RUN chown -R app:app /app /opt/venv
USER app

# Run
ENV DJANGO_SETTINGS_MODULE=worker.settings.base

CMD exec gunicorn --bind :$PORT --log-file - --workers 1 --threads 8 --timeout 180 worker.wsgi
