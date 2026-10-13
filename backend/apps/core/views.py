"""Health views and the CSRF view (DESIGN.md section 9, OPS-001)."""

import logging

from django.db import connection
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

logger = logging.getLogger(__name__)


def healthz(request: HttpRequest) -> JsonResponse:
    """OPS-001: return 200 while the process runs."""
    return JsonResponse({"status": "ok"})


def readyz(request: HttpRequest) -> JsonResponse:
    """OPS-001: return 200 only if the database answers."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        logger.exception("The database did not answer the readiness query.")
        return JsonResponse({"status": "database_unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


@extend_schema(responses={204: None})
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request: Request) -> Response:
    """Set the `csrftoken` cookie. The single-page app calls this view at start (DESIGN.md section 4.2)."""
    return Response(status=204)
