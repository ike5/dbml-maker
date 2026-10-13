"""Spec tests for the security requirements SEC-001, SEC-002, and SEC-005 (DESIGN.md section 15.4)."""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.testing import force_login, make_user
from apps.accounts.tests.conftest import AUTH, PASSWORD, login

pytestmark = pytest.mark.django_db


def test_sec_001_account_delete_without_the_csrf_token_gives_403(csrf_client: APIClient) -> None:
    """SEC-001: a state-changing request without the CSRF token gets 403."""
    user = make_user(password=PASSWORD)
    force_login(csrf_client, user.id)

    response = csrf_client.delete("/api/v1/accounts/me")

    assert response.status_code == 403
    assert User.objects.filter(id=user.id).exists()


def test_sec_002_passwords_use_argon2() -> None:
    """SEC-002: the stored password hash uses Argon2."""
    user = make_user(password=PASSWORD)

    assert User.objects.get(id=user.id).password.startswith("argon2")


def test_sec_005_login_has_a_rate_limit(api_client: APIClient) -> None:
    """SEC-005: a flood of login requests from one address gives 429."""
    statuses = [login(api_client, f"user{n}@example.com", "wrong-password-1").status_code for n in range(35)]

    assert statuses[0] == 400
    assert statuses[-1] == 429


def test_sec_005_failed_logins_for_one_address_are_blocked(api_client: APIClient) -> None:
    """SEC-005: after 5 failed logins for one address, the right password does not work.

    allauth answers this limit with 400 and the code `too_many_login_attempts`, not with 429.
    """
    make_user(email="ada@example.com", password=PASSWORD)

    for _ in range(5):
        assert login(api_client, "ada@example.com", "wrong-password-1").status_code == 400
    blocked = login(api_client, "ada@example.com")

    assert blocked.status_code == 400
    assert blocked.json()["errors"][0]["code"] == "too_many_login_attempts"
    assert api_client.get(f"{AUTH}/session").status_code == 401
