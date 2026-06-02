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

ENV UV_COMPILE_BYTECODE=1
ENV UV_PROJECT_ENVIRONMENT="/opt/venv"

# Install dependencies early to cache layer
COPY uv.lock pyproject.toml ./
COPY website/pyproject.toml ./website/
COPY calculator/pyproject.toml ./calculator/

RUN uv sync --frozen --no-install-project --package website

# Copy backend code
COPY calculator ./calculator
COPY website ./website

# Copy built frontend files to serve from this webserver
COPY --from=frontend /app/build/index.html ./website/src/website/templates/frontend/index.html
COPY --from=frontend /app/build/static ./website/src/website/static
COPY --from=frontend /app/public ./website/src/website/public

# Install backend code
RUN uv sync --frozen --package website

# Run as app user
RUN chown -R app:app /app /opt/venv
USER app

# Run
# ENV PATH="/app/.venv/bin:$PATH"
ENV PATH="/opt/venv/bin:$PATH"
ENV DJANGO_SETTINGS_MODULE=website.settings.base
CMD exec gunicorn --bind :$PORT --log-file - --workers 1 --threads 8 website.wsgi
