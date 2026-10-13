"""Settings for the tests (DESIGN.md section 15.1)."""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-secret-key-do-not-use-in-production")
os.environ.setdefault("DATABASE_URL", "postgres://dbml:dbml@localhost:5433/dbml")
os.environ["PUBLIC_BASE_URL"] = "http://testserver"

from .base import *  # noqa: F403

API_SCHEMA_ENABLED = True
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
# A memory cache makes the tests fast and independent.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
