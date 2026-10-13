"""Test helpers for the tests of other apps (DESIGN.md section 15.1). The tests of other apps never touch `User`."""

import itertools
from typing import Protocol
from uuid import UUID

from allauth.account.models import EmailAddress

from apps.accounts.api import UserRef
from apps.accounts.api import get_user as _get_user
from apps.accounts.models import User

_counter = itertools.count(1)


class _LoginClient(Protocol):
    def force_login(self, user: User, backend: str | None = None) -> None: ...


def make_user(
    *,
    email: str | None = None,
    password: str | None = None,
    display_name: str = "",
    verified: bool = True,
    is_staff: bool = False,
) -> UserRef:
    """Make a user. If `verified` is true, also make the verified primary `EmailAddress` row of allauth."""
    if email is None:
        email = f"user{next(_counter)}-{User.objects.count()}@example.com"
    user = User.objects.create_user(email, password, display_name=display_name, is_staff=is_staff)
    if verified:
        EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    return _get_user(user.id)


def force_login(client: _LoginClient, user_id: UUID) -> None:
    """Start a session for the user on a Django test client or a DRF `APIClient`. CSRF checks stay on."""
    client.force_login(User.objects.get(id=user_id))
