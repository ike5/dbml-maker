"""Tests for the layout validation (DESIGN.md section 7.2)."""

import pytest

from apps.core.errors import PayloadTooLarge, ValidationFailed
from apps.diagrams.layout import default_layout, validate_layout

GOOD = {"format": 1, "tables": {"public.users": {"x": 1, "y": -2.5}, "app.orders": {"x": 0, "y": 10**6}}}


def test_a_correct_layout_is_accepted():
    assert validate_layout(GOOD) == GOOD
    assert validate_layout(default_layout()) == {"format": 1, "tables": {}}


@pytest.mark.parametrize(
    "value",
    [
        None,
        [],
        "text",
        {},
        {"format": 1},
        {"tables": {}},
        {"format": 1, "tables": {}, "zoom": 2},
        {"format": 2, "tables": {}},
        {"format": "1", "tables": {}},
        {"format": True, "tables": {}},
        {"format": 1, "tables": []},
        {"format": 1, "tables": {"a.b": []}},
        {"format": 1, "tables": {"a.b": {"x": 1}}},
        {"format": 1, "tables": {"a.b": {"x": 1, "y": 2, "z": 3}}},
        {"format": 1, "tables": {"a.b": {"x": "1", "y": 2}}},
        {"format": 1, "tables": {"a.b": {"x": True, "y": 2}}},
        {"format": 1, "tables": {"a.b": {"x": None, "y": 2}}},
        {"format": 1, "tables": {"a.b": {"x": float("nan"), "y": 2}}},
        {"format": 1, "tables": {"a.b": {"x": 1, "y": float("inf")}}},
        {"format": 1, "tables": {"a.b": {"x": float("-inf"), "y": 2}}},
    ],
)
def test_a_wrong_layout_is_refused(value):
    with pytest.raises(ValidationFailed) as error:
        validate_layout(value)
    assert error.value.http_status == 400
    assert "layout" in (error.value.fields or {})


def test_a_layout_larger_than_the_limit_is_refused(settings):
    settings.DIAGRAM_LAYOUT_MAX_BYTES = 100
    tables = {f"public.t{i}": {"x": 1, "y": 2} for i in range(10)}
    with pytest.raises(PayloadTooLarge) as error:
        validate_layout({"format": 1, "tables": tables})
    assert error.value.code == "layout_too_large"
    assert error.value.http_status == 413
