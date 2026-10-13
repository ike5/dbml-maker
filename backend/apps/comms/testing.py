"""Test helpers for other apps (DESIGN.md section 15.1). Tests must not import `comms.models`."""

from dataclasses import dataclass

from apps.comms.models import OutboundEmail


@dataclass(frozen=True)
class OutboundEmailRef:
    key: str
    to_address: str
    subject: str
    body: str
    status: str


def list_outbound_emails(*, to: str | None = None) -> list[OutboundEmailRef]:
    """Return the recorded emails, oldest first. If `to` is set, return only the emails for that address."""
    queryset = OutboundEmail.objects.order_by("created_at", "id")
    if to is not None:
        queryset = queryset.filter(to_address=to.lower())
    return [OutboundEmailRef(e.key, e.to_address, e.subject, e.body, e.status) for e in queryset]
