"""The DRF exception handler. It makes the error envelope (DESIGN.md sections 3.7 and 11.3)."""

import logging
import math
from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from apps.core.errors import DomainError

logger = logging.getLogger(__name__)

# Fixed messages. They are STE text, and they do not show internal data.
_MESSAGES = {
    "validation_failed": "The input is not correct.",
    "not_authenticated": "You must log in to do this action.",
    "permission_denied": "You do not have permission to do this action.",
    "not_found": "The object does not exist.",
    "method_not_allowed": "The server does not accept this method.",
    "throttled": "There are too many requests. Wait and try again.",
    "unsupported_media_type": "The server does not accept this content type. Send JSON.",
    "server_error": "An error occurred on the server. Try again later.",
}


def _envelope(
    code: str,
    message: str,
    status: int,
    *,
    fields: dict[str, Any] | None = None,
    extra: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> Response:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields is not None:
        error["fields"] = fields
    if extra:
        error.update(extra)
    return Response({"error": error}, status=status, headers=headers)


def _collect_errors(detail: Any, path: str, out: dict[str, list[str]]) -> None:
    """Walk the DRF error detail. Write a list of strings for each field path, for example `items.0.name`."""
    if isinstance(detail, dict):
        for key, value in detail.items():
            _collect_errors(value, f"{path}.{key}" if path else str(key), out)
    elif isinstance(detail, list):
        for index, item in enumerate(detail):
            if isinstance(item, dict | list):
                # An item of a list of nested objects: the index tells which item has the error.
                _collect_errors(item, f"{path}.{index}" if path else str(index), out)
            else:
                out.setdefault(path or "non_field_errors", []).append(str(item))


def _flatten_errors(detail: Any) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    _collect_errors(detail, "", result)
    return result


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    if isinstance(exc, DomainError):
        return _envelope(exc.code, exc.message, exc.http_status, fields=exc.fields, extra=exc.extra)

    if isinstance(exc, drf_exceptions.ValidationError):
        return _envelope("validation_failed", _MESSAGES["validation_failed"], 400, fields=_flatten_errors(exc.detail))
    if isinstance(exc, drf_exceptions.ParseError):
        return _envelope("validation_failed", _MESSAGES["validation_failed"], 400)
    if isinstance(exc, drf_exceptions.NotAuthenticated | drf_exceptions.AuthenticationFailed):
        # Run the DRF handler for the `WWW-Authenticate` header, then use our own body.
        response = drf_exception_handler(exc, context)
        headers = {}
        if response is not None and "WWW-Authenticate" in response:
            headers["WWW-Authenticate"] = response["WWW-Authenticate"]
        return _envelope("not_authenticated", _MESSAGES["not_authenticated"], 401, headers=headers)
    if isinstance(exc, drf_exceptions.PermissionDenied | DjangoPermissionDenied):
        return _envelope("permission_denied", _MESSAGES["permission_denied"], 403)
    if isinstance(exc, drf_exceptions.NotFound | Http404):
        return _envelope("not_found", _MESSAGES["not_found"], 404)
    if isinstance(exc, drf_exceptions.MethodNotAllowed):
        return _envelope("method_not_allowed", _MESSAGES["method_not_allowed"], 405)
    if isinstance(exc, drf_exceptions.Throttled):
        headers = {}
        wait = getattr(exc, "wait", None)
        if wait is not None:
            headers["Retry-After"] = str(math.ceil(wait))
        return _envelope("throttled", _MESSAGES["throttled"], 429, headers=headers)
    if isinstance(exc, drf_exceptions.UnsupportedMediaType):
        return _envelope("unsupported_media_type", _MESSAGES["unsupported_media_type"], 415)

    # An unknown error. The log gets the traceback. The response gets no internal data.
    logger.error("Unhandled exception in an API view.", exc_info=exc)
    return _envelope("server_error", _MESSAGES["server_error"], 500)
