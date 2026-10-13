"""The allauth adapter (DESIGN.md section 5.1). A later task adds `send_mail`."""

from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings
from django.http import HttpRequest


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request: HttpRequest) -> bool:
        """AUTH-006: an operator can close the sign-up with `SIGNUP_ENABLED`."""
        return bool(settings.SIGNUP_ENABLED)
