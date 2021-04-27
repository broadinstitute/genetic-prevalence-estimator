FROM python:3.9-slim

RUN useradd --create-home app

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install dependencies
RUN pip install --no-cache-dir gunicorn==20.1.0 psycopg2-binary==2.8.6

COPY website/website-requirements.txt ./website/website-requirements.txt
RUN pip install --no-cache-dir -r ./website/website-requirements.txt

COPY shared-requirements.txt ./shared-requirements.txt
RUN pip install --no-cache-dir -r ./shared-requirements.txt

# Copy code
COPY calculator ./calculator
RUN pip install -e calculator

COPY website ./website
RUN pip install -e website

# Run as app user
RUN chown -R app .
USER app

# Run
ENV DJANGO_SETTINGS_MODULE=website.settings.base
CMD exec gunicorn --bind :$PORT --log-file - --workers 1 --threads 8 website.wsgi
