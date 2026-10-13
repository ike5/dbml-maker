"""Thin views of `accounts` (DESIGN.md section 5.4)."""

from datetime import UTC, datetime
from typing import cast
from uuid import UUID

from django.contrib.auth import logout
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts import services


def _last_authentication(request: Request) -> datetime | None:
    """Read the time of the newest login or reauthentication from the allauth data in the session."""
    # Imported here: a top-level import of this allauth module is circular at start.
    from allauth.account.authentication import get_authentication_records

    records = get_authentication_records(request._request)
    times = [float(record["at"]) for record in records if "at" in record]
    return datetime.fromtimestamp(max(times), tz=UTC) if times else None


class AccountMeView(APIView):
    throttle_classes = [ScopedRateThrottle]  # noqa: RUF012
    throttle_scope = "account_delete"

    @extend_schema(responses={204: None})
    def delete(self, request: Request) -> Response:
        services.delete_account(cast("UUID", request.user.pk), authenticated_at=_last_authentication(request))
        logout(request._request)
        return Response(status=204)
