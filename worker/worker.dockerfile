###############################################################################
# Base image
###############################################################################
FROM python:3.9-slim as base

RUN useradd --create-home app

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install dependencies
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

###############################################################################
# Development image
###############################################################################
FROM base as development

COPY .pylintrc ./.pylintrc
COPY dev-requirements.txt ./dev-requirements.txt
RUN pip install --no-cache-dir -r ./dev-requirements.txt

###############################################################################
# Production image
###############################################################################
FROM base as production

CMD exec gunicorn --bind :$PORT --log-file - --workers 1 --threads 8 worker.wsgi
