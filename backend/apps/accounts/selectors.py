"""Read queries of `accounts` (DESIGN.md section 5.5)."""

from collections.abc import Iterable
from uuid import UUID

from apps.accounts.errors import UserNotFound
from apps.accounts.models import User


def get_user(user_id: UUID) -> User:
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise UserNotFound from None


def get_users(user_ids: Iterable[UUID]) -> list[User]:
    return list(User.objects.filter(id__in=list(user_ids)))
