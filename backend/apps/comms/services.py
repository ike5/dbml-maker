"""The business workflows of `comms` (DESIGN.md section 8.1)."""

from django.db import transaction

from apps.comms.models import OutboundEmail
from apps.comms.tasks import deliver_email
from apps.core.jobs import defer_on_commit


def send_email(*, to: str, subject: str, body: str, key: str) -> None:
    """Record an email and enqueue its delivery. A key that exists before makes no change."""
    with transaction.atomic():
        # `get_or_create` handles two calls with the same key at the same time.
        email, created = OutboundEmail.objects.get_or_create(
            key=key,
            defaults={"to_address": to.lower(), "subject": subject, "body": body},
        )
        if created:
            defer_on_commit(deliver_email, email_id=str(email.id))
