"""Spec tests for the requirements AUTH-001 to AUTH-006 (DESIGN.md sections 5 and 15.4)."""

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.testing import make_user
from apps.accounts.tests.conftest import AUTH, PASSWORD, key_from_email, last_email, login, post
from apps.comms.testing import list_outbound_emails

pytestmark = pytest.mark.django_db


def test_auth_001_signup_makes_an_account_and_sends_a_verification_email(
    api_client: APIClient,
    django_capture_on_commit_callbacks,
) -> None:
    """AUTH-001: a sign-up makes an account and sends a verification email. No session starts."""
    with django_capture_on_commit_callbacks(execute=True):
        response = post(api_client, f"{AUTH}/signup", {"email": "new@example.com", "password": PASSWORD})

    assert response.status_code == 401
    assert any(flow["id"] == "verify_email" and flow["is_pending"] for flow in response.json()["data"]["flows"])
    assert User.objects.filter(email="new@example.com").exists()
    email = last_email("new@example.com")
    assert key_from_email(email, "verify-email")
    assert "DBML Maker" in email.body
    assert "\n" not in email.subject
    assert api_client.get(f"{AUTH}/session").status_code == 401


def test_auth_002_login_before_verification_gives_no_session(api_client: APIClient) -> None:
    """AUTH-002: a user cannot log in before the verification of the email address."""
    post(api_client, f"{AUTH}/signup", {"email": "new@example.com", "password": PASSWORD})

    response = login(api_client, "new@example.com")
    assert response.status_code == 401
    assert any(flow["id"] == "verify_email" and flow["is_pending"] for flow in response.json()["data"]["flows"])
    assert api_client.get(f"{AUTH}/session").status_code == 401

    key = key_from_email(last_email("new@example.com"), "verify-email")
    verified = post(api_client, f"{AUTH}/email/verify", {"key": key})
    assert verified.status_code == 200, verified.json()
    assert api_client.get(f"{AUTH}/session").status_code == 200


def test_auth_003_signup_and_reset_give_the_same_response_for_known_and_unknown_addresses() -> None:
    """AUTH-003: the system does not tell whether an email address has an account."""
    make_user(email="known@example.com", password=PASSWORD)

    signup_known = post(APIClient(), f"{AUTH}/signup", {"email": "known@example.com", "password": PASSWORD})
    signup_new = post(APIClient(), f"{AUTH}/signup", {"email": "unknown@example.com", "password": PASSWORD})
    assert signup_known.status_code == signup_new.status_code
    assert signup_known.json() == signup_new.json()

    reset_known = post(APIClient(), f"{AUTH}/password/request", {"email": "known@example.com"})
    reset_unknown = post(APIClient(), f"{AUTH}/password/request", {"email": "nobody@example.com"})
    assert reset_known.status_code == reset_unknown.status_code == 200
    assert reset_known.json() == reset_unknown.json()

    # Both addresses get an email, so the response time does not show a difference either.
    assert list_outbound_emails(to="known@example.com")
    assert list_outbound_emails(to="nobody@example.com")


def test_auth_004_password_reset_with_the_key_from_the_email(api_client: APIClient) -> None:
    """AUTH-004: a user resets the password with the key from the email, then logs in with the new password."""
    make_user(email="ada@example.com", password=PASSWORD)

    assert post(api_client, f"{AUTH}/password/request", {"email": "ada@example.com"}).status_code == 200
    key = key_from_email(last_email("ada@example.com"), "reset-password")

    new_password = "another-long-password-2"
    reset = post(APIClient(), f"{AUTH}/password/reset", {"key": key, "password": new_password})
    assert reset.status_code in (200, 401)

    client = APIClient()
    assert login(client, "ada@example.com", PASSWORD).status_code == 400
    assert login(client, "ada@example.com", new_password).status_code == 200


def test_auth_005_account_delete_deletes_the_user_and_sends_a_confirmation(api_client: APIClient) -> None:
    """AUTH-005: a delete with a recent login removes the user, ends the session, and records an email."""
    user = make_user(email="ada@example.com", password=PASSWORD)
    assert login(api_client, "ada@example.com").status_code == 200

    response = api_client.delete("/api/v1/accounts/me")

    assert response.status_code == 204
    assert not User.objects.filter(id=user.id).exists()
    assert api_client.get(f"{AUTH}/session").status_code == 401
    emails = list_outbound_emails(to="ada@example.com")
    assert [email.key for email in emails] == [f"account-deleted:{user.id}"]
    assert "deleted" in emails[0].subject


def _age_authentication(client: APIClient, seconds: int) -> None:
    session = client.session
    records = session["account_authentication_methods"]
    for record in records:
        record["at"] -= seconds
    session["account_authentication_methods"] = records
    session.save()


def test_auth_005_account_delete_without_recent_authentication_gives_401(api_client: APIClient) -> None:
    """AUTH-005: an old login is not enough. A reauthentication makes the delete possible again."""
    user = make_user(email="ada@example.com", password=PASSWORD)
    login(api_client, "ada@example.com")
    _age_authentication(api_client, 3600)

    response = api_client.delete("/api/v1/accounts/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "reauthentication_required"
    assert User.objects.filter(id=user.id).exists()
    assert not list_outbound_emails(to="ada@example.com")

    reauthenticate = post(api_client, f"{AUTH}/reauthenticate", {"password": PASSWORD})
    assert reauthenticate.status_code == 200
    assert api_client.delete("/api/v1/accounts/me").status_code == 204
    assert not User.objects.filter(id=user.id).exists()


def test_auth_005_account_delete_for_a_forced_session_gives_401(api_client: APIClient) -> None:
    """AUTH-005: a session without an authentication record counts as not authenticated."""
    from apps.accounts.testing import force_login

    user = make_user(password=PASSWORD)
    force_login(api_client, user.id)

    response = api_client.delete("/api/v1/accounts/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "reauthentication_required"


def test_auth_006_closed_signup_refuses_each_signup(api_client: APIClient, settings) -> None:
    """AUTH-006: if `SIGNUP_ENABLED` is false, the system refuses each sign-up."""
    settings.SIGNUP_ENABLED = False

    response = post(api_client, f"{AUTH}/signup", {"email": "new@example.com", "password": PASSWORD})

    assert response.status_code == 403
    assert not User.objects.filter(email="new@example.com").exists()
