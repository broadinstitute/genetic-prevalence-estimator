"""Django settings for local development."""

from .base import *  # pylint: disable=wildcard-import,unused-wildcard-import


DEBUG = True

# Log database queries
LOGGING["loggers"]["django.db.backends"] = {
    "level": "DEBUG",
    "propagate": False,
}

SECURE_SSL_REDIRECT = False

SESSION_COOKIE_SECURE = False

CSRF_COOKIE_SECURE = False
