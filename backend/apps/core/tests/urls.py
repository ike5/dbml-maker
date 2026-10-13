"""Test-only URL routes. Tests select them with `@pytest.mark.urls`."""

from django.urls import path
from rest_framework import exceptions as drf
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core import errors, views
from apps.core.pagination import CursorPagination

RAISERS = {
    "domain": errors.DomainError("Custom text.", code="custom_code", http_status=418),
    "domain-fields": errors.ValidationFailed(fields={"name": ["Type a name."]}),
    "domain-extra": errors.Conflict(code="diagram_conflict", extra={"current_change_number": 7}),
    "not-found": errors.NotFound(),
    "forbidden": errors.Forbidden(),
    "conflict": errors.Conflict(),
    "precondition-failed": errors.PreconditionFailed(),
    "precondition-required": errors.PreconditionRequired(),
    "too-large": errors.PayloadTooLarge(),
    "drf-validation": drf.ValidationError({"name": ["Type a name."], "tags": {"0": ["Bad tag."]}}),
    "drf-validation-list": drf.ValidationError(["Bad input."]),
    "drf-validation-text": drf.ValidationError("Bad input."),
    "drf-validation-nested-list": drf.ValidationError({"items": [{"a": ["Bad."]}, ["Also bad."]]}),
    "not-authenticated": drf.NotAuthenticated(),
    "authentication-failed": drf.AuthenticationFailed(),
    "permission-denied": drf.PermissionDenied(),
    "drf-not-found": drf.NotFound(),
    "method-not-allowed": drf.MethodNotAllowed("POST"),
    "throttled": drf.Throttled(wait=12.2),
    "throttled-no-wait": drf.Throttled(),
    "parse-error": drf.ParseError(),
    "unsupported": drf.UnsupportedMediaType("text/plain"),
    "unknown": RuntimeError("secret internal detail"),
}


class RaiseView(APIView):
    permission_classes = [AllowAny]

    def get(self, request: Request, kind: str) -> Response:
        raise RAISERS[kind]


class ProtectedView(APIView):
    """Uses the default permission (`IsAuthenticated`) and the default authentication."""

    def get(self, request: Request) -> Response:
        return Response({"ok": True})

    def post(self, request: Request) -> Response:
        return Response({"ok": True})


class SessionSerializer(serializers.Serializer):
    session_key = serializers.CharField()


class PagedView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = SessionSerializer
    pagination_class = type("Pager", (CursorPagination,), {"ordering": "session_key"})

    def get_queryset(self):
        from django.contrib.sessions.models import Session

        return Session.objects.all()


urlpatterns = [
    path("raise/<str:kind>", RaiseView.as_view()),
    path("csrf", views.csrf),
    path("protected", ProtectedView.as_view()),
    path("paged", PagedView.as_view()),
]
