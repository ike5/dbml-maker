"""Tests for the adapter, the email templates, the delete endpoint, and the jobs of `accounts`."""

import re

import pytest
from allauth.account.adapter import get_adapter
from django.template.loader import render_to_string
from procrastinate.testing import InMemoryConnector
from rest_framework.test import APIClient

from apps.accounts import tasks
from apps.accounts.testing import force_login, make_user
from apps.comms.testing import list_outbound_emails

pytestmark = pytest.mark.django_db

NOTIFICATION_CONTEXT = {
    "ip": "127.0.0.1",
    "user_agent": "test-agent",
    "timestamp": "2026-01-01",
    "from_email": "old@example.com",
    "to_email": "new@example.com",
    "deleted_email": "old@example.com",
}
LINK_CONTEXT = {
    "activate_url": "http://testserver/verify-email/KEY123",
    "password_reset_url": "http://testserver/reset-password/KEY456",
    "signup_url": "http://testserver/signup",
}
PREFIXES = [
    "account_already_exists",
    "email_changed",
    "email_confirm",
    "email_confirmation",
    "email_confirmation_signup",
    "email_deleted",
    "password_changed",
    "password_reset",
    "password_reset_key",
    "password_set",
    "unknown_account",
]


@pytest.mark.parametrize("prefix", PREFIXES)
def test_each_email_template_renders_in_plain_text(prefix: str) -> None:
    context = {"email": "ada@example.com", **NOTIFICATION_CONTEXT, **LINK_CONTEXT}

    subject = render_to_string(f"account/email/{prefix}_subject.txt", context)
    body = render_to_string(f"account/email/{prefix}_message.txt", context)

    assert subject.strip()
    assert "DBML Maker" in body
    assert "<" not in body
    assert "example.com" not in subject
    # No template of allauth is in use: its text says "Hello from" and "Thank you for using".
    assert "Thank you for using" not in body


def test_the_links_render_without_escape() -> None:
    context = {"email": "ada@example.com", **LINK_CONTEXT}

    confirmation = render_to_string("account/email/email_confirmation_message.txt", context)
    reset = render_to_string("account/email/password_reset_key_message.txt", context)
    unknown = render_to_string("account/email/unknown_account_message.txt", context)
    exists = render_to_string("account/email/account_already_exists_message.txt", context)

    assert "http://testserver/verify-email/KEY123" in confirmation
    assert "http://testserver/reset-password/KEY456" in reset
    assert "http://testserver/signup" in unknown
    assert "http://testserver/reset-password/KEY456" in exists


def test_the_adapter_gives_a_one_line_subject_and_a_new_key_to_comms() -> None:
    adapter = get_adapter()

    adapter.send_mail("account/email/password_reset_key", "ada@example.com", LINK_CONTEXT)
    adapter.send_mail("account/email/password_reset_key", "ada@example.com", LINK_CONTEXT)

    first, second = list_outbound_emails(to="ada@example.com")
    assert first.subject == "Reset your password"
    assert re.fullmatch(r"allauth:[0-9a-f-]{36}", first.key)
    assert first.key != second.key
    assert "http://testserver/reset-password/KEY456" in first.body


def test_the_delete_endpoint_needs_a_session(api_client: APIClient) -> None:
    assert api_client.delete("/api/v1/accounts/me").status_code == 401


def test_the_delete_endpoint_has_a_throttle(api_client: APIClient) -> None:
    user = make_user(password="a-long-password-1")
    force_login(api_client, user.id)

    statuses = [api_client.delete("/api/v1/accounts/me").status_code for _ in range(11)]

    assert statuses[:10] == [401] * 10
    assert statuses[10] == 429


def test_clear_expired_sessions_deletes_the_expired_sessions(job_connector: InMemoryConnector) -> None:
    from datetime import timedelta

    from django.contrib.sessions.models import Session
    from django.utils import timezone

    Session.objects.create(session_key="old", session_data="x", expire_date=timezone.now() - timedelta(days=1))
    Session.objects.create(session_key="live", session_data="x", expire_date=timezone.now() + timedelta(days=1))

    tasks.clear_expired_sessions(timestamp=0)

    assert list(Session.objects.values_list("session_key", flat=True)) == ["live"]
