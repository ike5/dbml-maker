"""DRF authentication class (DESIGN.md section 4.1)."""

from rest_framework import authentication
from rest_framework.request import Request


class SessionAuthentication(authentication.SessionAuthentication):
    """Session authentication that gives 401 and not 403 to an anonymous request.

    DRF gives 403 when the first authentication class has no `authenticate_header`.
    """

    def authenticate_header(self, request: Request) -> str:
        return "Session"
