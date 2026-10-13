"""The models of `comms` (DESIGN.md sections 8.2 and 14.2)."""

from django.db import models

from apps.core.models import BaseModel


class OutboundEmail(BaseModel):
    """A record of one email and its delivery state."""

    class Status(models.TextChoices):
        QUEUED = "queued"
        SENT = "sent"
        FAILED = "failed"

    # The idempotency key: a second `send_email` call with the same key has no effect.
    key = models.CharField(max_length=200, unique=True)
    to_address = models.CharField(max_length=254)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    attempts = models.IntegerField(default=0)
    last_error = models.TextField(default="", blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.key} ({self.status})"
