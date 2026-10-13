"""Fixtures and helpers for the tests of `accounts`. The tests use the real allauth endpoints (section 5.3)."""

import re
from collections.abc import Iterator
from typing import Any
from urllib.parse import unquote

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.comms.testing import OutboundEmailRef, list_outbound_emails

AUTH = "/_allauth/browser/v1/auth"
PASSWORD = "a-long-password-1"


@pytest.fixture(autouse=True)
def clear_cache() -> Iterator[None]:
    """The rate limits of allauth and the throttles of DRF count in the cache. Each test starts with a clean count."""
    cache.clear()
    yield
    cache.clear()


def post(client: APIClient, path: str, data: dict[str, Any]) -> Any:
    """Return the DRF test response. Its type is `Any`, because the stubs do not know `json()`."""
    return client.post(path, data, format="json")


def last_email(to: str) -> OutboundEmailRef:
    return list_outbound_emails(to=to)[-1]


def key_from_email(email: OutboundEmailRef, route: str) -> str:
    """Read the key from the SPA link in the body (HEADLESS_FRONTEND_URLS)."""
    match = re.search(rf"http://testserver/{route}/(\S+)", email.body)
    assert match, email.body
    # The key has a colon, and allauth writes it as %3A in the URL. The SPA router decodes it.
    return unquote(match.group(1))


def login(client: APIClient, email: str, password: str = PASSWORD) -> Any:
    return post(client, f"{AUTH}/login", {"email": email, "password": password})
