"""Settings for local work (DESIGN.md section 16.1)."""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "dev-only-secret-key-do-not-use-in-production")
os.environ.setdefault("DATABASE_URL", "postgres://dbml:dbml@localhost:5433/dbml")
os.environ.setdefault("PUBLIC_BASE_URL", "http://localhost:5173")

from .base import *  # noqa: F403
from .base import ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS

DEBUG = True
API_SCHEMA_ENABLED = True
ALLOWED_HOSTS = [*ALLOWED_HOSTS, "localhost", "127.0.0.1"]
CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, "http://localhost:8000"]

# Mailpit receives all email.
EMAIL_HOST = "localhost"
EMAIL_PORT = 1025
