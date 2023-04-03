"""Django settings for production."""

# google-cloud-logging is not installed in the dev environment so Pylint can't find it.
from google.cloud import logging  # pylint: disable=no-name-in-module

from .base import *  # pylint: disable=wildcard-import,unused-wildcard-import

# https://cloud.google.com/logging/docs/setup/python
cloud_logging_client = logging.Client()
cloud_logging_client.setup_logging()

LOGGING = {
    "handlers": {
        "stackdriver": {
            "class": "google.cloud.logging.handlers.StructuredLogHandler",
            "client": cloud_logging_client,
        }
    },
    "loggers": {"": {"handlers": ["stackdriver"], "level": "INFO"}},
}
