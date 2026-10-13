"""Production settings. This module gives no defaults (DESIGN.md sections 4.6 and 16.4)."""

from .base import *  # noqa: F403
from .base import PUBLIC_BASE_URL

DEBUG = False

if PUBLIC_BASE_URL.startswith("https://"):
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 365 * 24 * 60 * 60
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
else:
    # An installation over plain HTTP can still run, for example behind a test proxy.
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
