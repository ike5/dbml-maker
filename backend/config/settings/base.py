"""Base settings. The `dev`, `test`, and `prod` modules import this module (DESIGN.md sections 4 and 16.4)."""

import os
import re
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url
from csp.constants import NONE, SELF, UNSAFE_INLINE
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent
REPO_DIR = BASE_DIR.parent


def env_required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise ImproperlyConfigured(f"The environment variable {name} is necessary.")
    return value


def env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


SECRET_KEY = env_required("DJANGO_SECRET_KEY")
PUBLIC_BASE_URL = env_required("PUBLIC_BASE_URL").rstrip("/")
_public_host = urlparse(PUBLIC_BASE_URL).hostname
if not _public_host:
    raise ImproperlyConfigured("PUBLIC_BASE_URL must be a full URL, for example https://dbml.example.com.")

DEBUG = False
ALLOWED_HOSTS = [_public_host]
CSRF_TRUSTED_ORIGINS = [PUBLIC_BASE_URL]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "allauth",
    "allauth.account",
    "allauth.headless",
    "procrastinate.contrib.django",
    "csp",
    "apps.core",
    "apps.comms",
    "apps.accounts",
    "apps.workspaces",
    "apps.diagrams",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "csp.middleware.CSPMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "apps.core.middleware.ReleaseHeaderMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database and cache (DESIGN.md section 14) ---

DATABASES = {
    "default": dj_database_url.parse(
        env_required("DATABASE_URL"),
        conn_max_age=60,
        conn_health_checks=True,
    ),
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "core_cache",
    },
}

# --- Users and passwords (DESIGN.md sections 4.5 and 5) ---

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

# SEC-002: Argon2 must be the first hasher.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Sessions and cookies (DESIGN.md sections 4.1 and 4.2) ---

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_HTTPONLY = True  # SEC-003
SESSION_COOKIE_SECURE = False  # The prod settings turn it on.
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 14 * 24 * 60 * 60
# The single-page app reads the CSRF cookie and sends it in the X-CSRFToken header.
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SECURE = False  # The prod settings turn it on.
CSRF_COOKIE_SAMESITE = "Lax"

# --- REST framework (DESIGN.md section 11) ---

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.core.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "public_link": "60/min",
        "shares": "30/min",
        "account_delete": "10/hour",
    },
}
SPECTACULAR_SETTINGS = {
    "TITLE": "DBML Maker API",
    "VERSION": "1",
    "SERVE_INCLUDE_SCHEMA": False,
}
API_SCHEMA_ENABLED = False

# A 1 MiB source can double in size when JSON escapes it.
DATA_UPLOAD_MAX_MEMORY_SIZE = 4 * 1024 * 1024

# --- allauth in headless mode (DESIGN.md section 5.1) ---

HEADLESS_ONLY = True
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": f"{PUBLIC_BASE_URL}/verify-email/{{key}}",
    "account_reset_password_from_key": f"{PUBLIC_BASE_URL}/reset-password/{{key}}",
    "account_signup": f"{PUBLIC_BASE_URL}/signup",
}
ACCOUNT_ADAPTER = "apps.accounts.adapter.AccountAdapter"
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_CHANGE_EMAIL = True
ACCOUNT_PREVENT_ENUMERATION = True
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
ACCOUNT_LOGIN_ON_PASSWORD_RESET = True
ACCOUNT_EMAIL_SUBJECT_PREFIX = ""
ACCOUNT_REAUTHENTICATION_TIMEOUT = 300
# The links in the emails carry a key. The user does not type a code.
ACCOUNT_EMAIL_VERIFICATION_BY_CODE_ENABLED = False
ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED = False
ACCOUNT_LOGIN_BY_CODE_ENABLED = False
# SEC-005: rate limits for login, sign-up, and password reset. The cache is the PostgreSQL table.
ACCOUNT_RATE_LIMITS = {
    "login": "30/m/ip",
    "login_failed": "10/m/ip,5/5m/key",
    "signup": "20/m/ip",
    "reset_password": "20/m/ip,5/m/key",
    "reset_password_from_key": "20/m/ip",
}

SIGNUP_ENABLED = env_bool("SIGNUP_ENABLED", True)

# --- Diagram limits (DESIGN.md section 7.1) ---

DIAGRAM_SOURCE_MAX_BYTES = 1_048_576
DIAGRAM_LAYOUT_MAX_BYTES = 262_144
DIAGRAM_NAME_MAX_CHARS = 200
DIAGRAM_MAX_SHARES = 100
DIAGRAM_AUTO_VERSION_MINUTES = 10
DIAGRAM_AUTO_VERSION_DAYS = 90
DIAGRAM_TRASH_DAYS = 30

# --- Email (DESIGN.md sections 8 and 16.4) ---

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "25"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL") or f"noreply@{_public_host}"
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# --- Logging (DESIGN.md sections 9 and 10.2) ---

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "apps.core.logging.JsonFormatter"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json"}},
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
        "procrastinate": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
    },
}

# --- HTTP headers (DESIGN.md section 4.6) ---

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
CONTENT_SECURITY_POLICY = {
    "DIRECTIVES": {
        "default-src": [SELF],
        "script-src": [SELF],
        # Deviation: CodeMirror and React Flow set inline styles (DESIGN.md section 18.2).
        "style-src": [SELF, UNSAFE_INLINE],
        "img-src": [SELF, "data:", "blob:"],
        "worker-src": [SELF, "blob:"],
        "connect-src": [SELF],
        "frame-ancestors": [NONE],
        "base-uri": [NONE],
        "form-action": [SELF],
    },
}

# --- Static files and the single-page app (DESIGN.md section 16.3) ---

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
_frontend_dist = REPO_DIR / "frontend" / "dist"
STATICFILES_DIRS = [_frontend_dist] if _frontend_dist.is_dir() else []
SPA_INDEX_PATH = _frontend_dist / "index.html"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Vite already puts a hash in the file names, so no manifest is necessary.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
_HASHED_ASSET = re.compile(r"^assets/.+[-.][A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$")


def immutable_file_test(path: str, url: str) -> bool:
    """Mark a hashed file in `assets/` as immutable, so that browsers keep it for one year."""
    return bool(_HASHED_ASSET.match(url.removeprefix(STATIC_URL)))


WHITENOISE_IMMUTABLE_FILE_TEST = immutable_file_test

# --- Other ---

APP_RELEASE = os.environ.get("APP_RELEASE", "dev")
LANGUAGE_CODE = "en-us"
USE_TZ = True
TIME_ZONE = "UTC"
USE_I18N = False

# The email address is unique on `lower(email)` (DESIGN.md section 5.2). Django cannot see a function index.
SILENCED_SYSTEM_CHECKS = ["auth.W004"]
