"""Public interface of `accounts` (DESIGN.md section 5.5). Other apps import only this module."""

from collections.abc import Iterable
from dataclasses import dataclass
from uuid import UUID

from apps.accounts import selectors
from apps.accounts.errors import UserNotFound
from apps.accounts.models import User

__all__ = ["UserNotFound", "UserRef", "get_user", "get_users"]


@dataclass(frozen=True)
class UserRef:
    id: UUID
    email: str
    display_name: str


def _to_ref(user: User) -> UserRef:
    return UserRef(id=user.id, email=user.email, display_name=user.display_name)


def get_user(user_id: UUID) -> UserRef:
    """Raise `UserNotFound` if the user does not exist."""
    return _to_ref(selectors.get_user(user_id))


def get_users(user_ids: Iterable[UUID]) -> dict[UUID, UserRef]:
    """Unknown IDs are not in the result."""
    return {user.id: _to_ref(user) for user in selectors.get_users(user_ids)}
