"""Validation of the layout (DESIGN.md section 7.2)."""

import json
import math
from typing import Any

from django.conf import settings

from apps.core.errors import PayloadTooLarge, ValidationFailed

LAYOUT_FORMAT = 1


def default_layout() -> dict[str, Any]:
    return {"format": LAYOUT_FORMAT, "tables": {}}


def _fail(message: str) -> ValidationFailed:
    return ValidationFailed(fields={"layout": [message]})


def _is_finite_number(value: object) -> bool:
    # `bool` is a subclass of `int`, but a bool is not a position.
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value)


def validate_layout(value: object) -> dict[str, Any]:
    """Return the layout if it has the format of section 7.2. If not, raise an error."""
    if not isinstance(value, dict):
        raise _fail("The layout must be an object.")
    if set(value) != {"format", "tables"}:
        raise _fail("The layout must have only the keys format and tables.")
    # `True == 1` in Python, so examine the type first.
    if isinstance(value["format"], bool) or value["format"] != LAYOUT_FORMAT:
        raise _fail("The format of the layout must be 1.")
    tables = value["tables"]
    if not isinstance(tables, dict):
        raise _fail("The tables of the layout must be an object.")
    for key, position in tables.items():
        if not isinstance(position, dict) or set(position) != {"x", "y"}:
            raise _fail(f"The position of the table {key} must have only the keys x and y.")
        if not (_is_finite_number(position["x"]) and _is_finite_number(position["y"])):
            raise _fail(f"The position of the table {key} must have finite numbers.")
    # The size limit comes last, so that a small wrong layout gets the more exact error.
    size = len(json.dumps(value, separators=(",", ":")).encode())
    if size > settings.DIAGRAM_LAYOUT_MAX_BYTES:
        raise PayloadTooLarge("The layout is too large.", code="layout_too_large")
    return value
