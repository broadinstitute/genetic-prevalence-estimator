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

RUN pip install --no-cache-dir gunicorn==20.1.0 psycopg2-binary==2.8.6

COPY worker/worker-requirements.txt ./worker/worker-requirements.txt
RUN pip install --no-cache-dir -r ./worker/worker-requirements.txt

COPY shared-requirements.txt ./shared-requirements.txt
RUN pip install --no-cache-dir -r ./shared-requirements.txt

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
