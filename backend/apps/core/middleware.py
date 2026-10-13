"""Middleware of the shared kernel."""

from collections.abc import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponseBase


class ReleaseHeaderMiddleware:
    """Add `X-App-Release` to each response, so that an old browser tab can find a new release (DESIGN.md 11.5)."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        response = self.get_response(request)
        response["X-App-Release"] = settings.APP_RELEASE
        return response
