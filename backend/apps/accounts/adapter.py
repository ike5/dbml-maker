"""The allauth adapter (DESIGN.md section 5.1)."""

import uuid
from typing import Any

from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings
from django.http import HttpRequest
from django.template.loader import render_to_string

from apps.comms import api as comms_api


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request: HttpRequest) -> bool:
        """AUTH-006: an operator can close the sign-up with `SIGNUP_ENABLED`."""
        return bool(settings.SIGNUP_ENABLED)

    def send_mail(self, template_prefix: str, email: str, context: dict[str, Any]) -> None:
        """Render the plain text email and give it to `comms` (DESIGN.md sections 5.1 and 8.3).

        Each allauth email gets a new key (section 8.1), because allauth can send the same kind of email many times.
        """
        context = {"email": email, **context}
        # A subject must have one line.
        subject = " ".join(render_to_string(f"{template_prefix}_subject.txt", context).split())
        body = render_to_string(f"{template_prefix}_message.txt", context).strip()
        comms_api.send_email(to=email, subject=subject, body=body, key=f"allauth:{uuid.uuid7()}")
