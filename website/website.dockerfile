###############################################################################
# Frontend build
###############################################################################
FROM node:24.16 as frontend

WORKDIR /app

RUN npm install -g pnpm@11.5

COPY frontend/package.json ./package.json
COPY frontend/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY frontend/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

COPY frontend ./

ENV NODE_OPTIONS="--openssl-legacy-provider"
RUN pnpm run build

###############################################################################
# Base image
###############################################################################
FROM python:3.13-slim as base

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /uvx /bin/

RUN useradd --create-home app

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install dependencies
RUN uv pip install --system gunicorn==20.1.0 psycopg2-binary==2.9.12

COPY website/website-requirements.txt ./website/website-requirements.txt
RUN uv pip install --system -r ./website/website-requirements.txt

COPY shared-requirements.txt ./shared-requirements.txt
RUN uv pip install --system -r ./shared-requirements.txt

# Copy code
COPY calculator ./calculator
RUN uv pip install --system -e calculator

COPY website ./website
RUN uv pip install --system -e website

COPY --from=frontend /app/build/index.html ./website/src/website/templates/frontend/index.html
COPY --from=frontend /app/build/static ./website/src/website/static
COPY --from=frontend /app/public ./website/src/website/public

# Run as app user
RUN chown -R app .
USER app

# Run
ENV DJANGO_SETTINGS_MODULE=website.settings.base

CMD exec gunicorn --bind :$PORT --log-file - --workers 1 --threads 8 website.wsgi
