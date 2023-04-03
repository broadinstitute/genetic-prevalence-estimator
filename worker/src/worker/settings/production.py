"""Django settings for production."""

from .base import *  # pylint: disable=wildcard-import,unused-wildcard-import


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "structured": {
            "class": "google.cloud.logging.handlers.StructuredLogHandler",
        }
    },
    "loggers": {
        "worker": {"handlers": ["structured"], "level": "INFO"},
    },
}
