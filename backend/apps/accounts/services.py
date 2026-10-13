"""Business workflows of `accounts` (DESIGN.md section 5.4)."""

from datetime import datetime
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from apps.accounts import selectors
from apps.accounts.errors import ReauthenticationRequired
from apps.comms import api as comms_api


@transaction.atomic
def delete_account(user_id: UUID, *, authenticated_at: datetime | None) -> None:
    """AUTH-005: delete the user, if the user authenticated in the last `ACCOUNT_REAUTHENTICATION_TIMEOUT` seconds.

    The rows in the upper apps point to `User` with `CASCADE` or `SET_NULL`, so Django removes or clears them.
    """
    if authenticated_at is None:
        raise ReauthenticationRequired
    if (timezone.now() - authenticated_at).total_seconds() > settings.ACCOUNT_REAUTHENTICATION_TIMEOUT:
        raise ReauthenticationRequired

    user = selectors.get_user(user_id)
    comms_api.send_email(
        to=user.email,
        subject=" ".join(render_to_string("accounts/email/account_deleted_subject.txt").split()),
        body=render_to_string("accounts/email/account_deleted_message.txt").strip(),
        key=f"account-deleted:{user_id}",
    )
    user.delete()
