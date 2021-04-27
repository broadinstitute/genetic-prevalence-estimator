"""Django settings for tests."""

from .base import *  # pylint: disable=wildcard-import,unused-wildcard-import


DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

SECURE_SSL_REDIRECT = False

SESSION_COOKIE_SECURE = False

CSRF_COOKIE_SECURE = False
