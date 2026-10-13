import logging

import pytest
from rest_framework.test import APIClient

pytestmark = [pytest.mark.urls("apps.core.tests.urls"), pytest.mark.django_db]


def get_error(kind: str) -> tuple[int, dict, object]:
    response = APIClient().get(f"/raise/{kind}")
    return response.status_code, response.json()["error"], response


@pytest.mark.parametrize(
    ("kind", "status", "code"),
    [
        ("not-found", 404, "not_found"),
        ("forbidden", 403, "permission_denied"),
        ("conflict", 409, "conflict"),
        ("precondition-failed", 412, "precondition_failed"),
        ("precondition-required", 428, "precondition_required"),
        ("too-large", 413, "payload_too_large"),
        ("not-authenticated", 401, "not_authenticated"),
        ("authentication-failed", 401, "not_authenticated"),
        ("permission-denied", 403, "permission_denied"),
        ("drf-not-found", 404, "not_found"),
        ("method-not-allowed", 405, "method_not_allowed"),
        ("parse-error", 400, "validation_failed"),
        ("unsupported", 415, "unsupported_media_type"),
        ("unknown", 500, "server_error"),
    ],
)
def test_each_exception_gives_the_envelope(kind: str, status: int, code: str) -> None:
    got_status, error, _ = get_error(kind)
    assert got_status == status
    assert error["code"] == code
    assert error["message"]
    assert "fields" not in error


def test_domain_error_can_override_its_attributes() -> None:
    status, error, _ = get_error("domain")
    assert (status, error) == (418, {"code": "custom_code", "message": "Custom text."})


def test_domain_error_with_fields_has_a_fields_key() -> None:
    status, error, _ = get_error("domain-fields")
    assert status == 400
    assert error["fields"] == {"name": ["Type a name."]}


def test_domain_error_extra_keys_merge_into_the_error_object() -> None:
    status, error, _ = get_error("domain-extra")
    assert status == 409
    assert error["code"] == "diagram_conflict"
    assert error["current_change_number"] == 7


def test_drf_validation_error_gives_fields_as_lists_of_strings() -> None:
    status, error, _ = get_error("drf-validation")
    assert status == 400
    assert error["code"] == "validation_failed"
    assert error["fields"] == {"name": ["Type a name."], "tags.0": ["Bad tag."]}


def test_drf_validation_error_without_a_field_name() -> None:
    assert get_error("drf-validation-list")[1]["fields"] == {"non_field_errors": ["Bad input."]}
    assert get_error("drf-validation-text")[1]["fields"] == {"non_field_errors": ["Bad input."]}


def test_drf_validation_error_with_nested_lists() -> None:
    assert get_error("drf-validation-nested-list")[1]["fields"] == {"items.0.a": ["Bad."], "items.1": ["Also bad."]}


def test_throttled_has_retry_after() -> None:
    status, error, response = get_error("throttled")
    assert status == 429
    assert error["code"] == "throttled"
    assert response["Retry-After"] == "13"  # type: ignore[index]


def test_throttled_without_wait_has_no_retry_after() -> None:
    _, _, response = get_error("throttled-no-wait")
    assert "Retry-After" not in response  # type: ignore[operator]


def test_unknown_exception_logs_the_traceback_and_hides_the_detail(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.ERROR):
        status, _error, response = get_error("unknown")
    assert status == 500
    assert "secret internal detail" not in response.content.decode()  # type: ignore[attr-defined]
    record = next(r for r in caplog.records if r.name == "apps.core.exceptions")
    assert record.exc_info is not None
    assert "secret internal detail" in str(record.exc_info[1])


def test_anonymous_request_to_an_authenticated_view_gives_401() -> None:
    response = APIClient().get("/protected")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"
    assert response["WWW-Authenticate"] == "Session"
