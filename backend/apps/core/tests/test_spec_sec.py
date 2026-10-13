"""Spec tests for the security requirements SEC-001 and SEC-003 (DESIGN.md section 19.2)."""

import os
import subprocess
import sys

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model


def _logged_in_client(csrf_client):
    # Core must not import another app, so the test uses the user model through the Django API.
    user = get_user_model().objects.create_user("sec001@example.com", "a-long-password-1")
    csrf_client.force_login(user)
    return csrf_client


@pytest.mark.urls("apps.core.tests.urls")
@pytest.mark.django_db
def test_sec_001_post_without_a_csrf_token_gives_403(csrf_client) -> None:
    """SEC-001: a logged-in user cannot send a POST without the CSRF token."""
    client = _logged_in_client(csrf_client)
    response = client.post("/protected", {}, format="json")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permission_denied"


@pytest.mark.urls("apps.core.tests.urls")
@pytest.mark.django_db
def test_sec_001_post_with_a_csrf_token_gives_200(csrf_client) -> None:
    """SEC-001: the token from the CSRF view makes a POST valid."""
    client = _logged_in_client(csrf_client)
    token_response = client.get("/csrf")
    assert token_response.status_code == 204
    token = token_response.cookies["csrftoken"].value
    response = client.post("/protected", {}, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 200


@pytest.mark.django_db
def test_sec_001_csrf_view_sets_the_cookie(client) -> None:
    """SEC-001: the single-page app can read the CSRF cookie, so the cookie is not HttpOnly."""
    response = client.get("/api/v1/csrf")
    assert response.status_code == 204
    assert response.cookies["csrftoken"].value
    assert not response.cookies["csrftoken"]["httponly"]


def test_sec_001_csrf_middleware_is_on() -> None:
    """SEC-001: the Django CSRF middleware is on for all views."""
    assert "django.middleware.csrf.CsrfViewMiddleware" in settings.MIDDLEWARE
    assert settings.CSRF_COOKIE_HTTPONLY is False
    assert settings.CSRF_TRUSTED_ORIGINS == [settings.PUBLIC_BASE_URL]


def test_sec_002_argon2_is_the_first_hasher() -> None:
    """SEC-002: Argon2 hashes the passwords."""
    assert settings.PASSWORD_HASHERS[0] == "django.contrib.auth.hashers.Argon2PasswordHasher"


def test_sec_003_cookie_settings() -> None:
    """SEC-003: the session cookie is HttpOnly and SameSite Lax, and it lasts 14 days."""
    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"
    assert settings.SESSION_COOKIE_AGE == 14 * 24 * 60 * 60
    assert settings.SESSION_ENGINE == "django.contrib.sessions.backends.db"


def _prod_settings(public_base_url: str) -> dict[str, str]:
    code = (
        "import json; from config.settings import prod; "
        "print(json.dumps({k: str(getattr(prod, k)) for k in "
        "['SESSION_COOKIE_SECURE', 'CSRF_COOKIE_SECURE', 'SECURE_SSL_REDIRECT', 'SECURE_HSTS_SECONDS', 'DEBUG']}))"
    )
    env = {
        **os.environ,
        "DJANGO_SECRET_KEY": "x" * 60,
        "DATABASE_URL": "postgres://u:p@localhost:5433/d",
        "PUBLIC_BASE_URL": public_base_url,
    }
    result = subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True, check=True)
    import json

    return json.loads(result.stdout.strip().splitlines()[-1])


def test_sec_003_prod_cookies_are_secure_on_https() -> None:
    """SEC-003: in production over HTTPS, the cookies are secure and the server redirects to HTTPS."""
    values = _prod_settings("https://dbml.example.com")
    assert values["SESSION_COOKIE_SECURE"] == "True"
    assert values["CSRF_COOKIE_SECURE"] == "True"
    assert values["SECURE_SSL_REDIRECT"] == "True"
    assert values["SECURE_HSTS_SECONDS"] == str(365 * 24 * 60 * 60)
    assert values["DEBUG"] == "False"


def test_sec_003_prod_over_http_has_no_secure_cookies() -> None:
    """SEC-003: an installation over plain HTTP can still run."""
    values = _prod_settings("http://dbml.example.com")
    assert values["SESSION_COOKIE_SECURE"] == "False"
    assert values["SECURE_SSL_REDIRECT"] == "False"


def test_sec_005_login_signup_and_reset_have_rate_limits() -> None:
    """SEC-005: allauth limits login, sign-up, and password reset."""
    assert {"login", "signup", "reset_password"} <= set(settings.ACCOUNT_RATE_LIMITS)
