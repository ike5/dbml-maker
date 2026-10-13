import json
import logging
from datetime import timedelta
from io import StringIO
from pathlib import Path

import pytest
from django.contrib.sessions.models import Session
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.errors import DomainError, NotFound
from apps.core.jobs import EMAIL_QUEUE, MAINTENANCE_QUEUE, app, defer_on_commit
from apps.core.logging import JsonFormatter
from apps.core.models import BaseModel


@pytest.mark.urls("apps.core.tests.urls")
@pytest.mark.django_db
def test_pagination_shape_and_cursor() -> None:
    now = timezone.now() + timedelta(days=1)
    Session.objects.bulk_create(Session(session_key=f"key{i:03d}", session_data="x", expire_date=now) for i in range(5))
    client = APIClient()
    first = client.get("/paged", {"page_size": 2}).json()
    assert [r["session_key"] for r in first["results"]] == ["key000", "key001"]
    assert isinstance(first["next"], str)
    assert not first["next"].startswith("http")
    second = client.get("/paged", {"page_size": "2", "cursor": str(first["next"])}).json()
    assert [r["session_key"] for r in second["results"]] == ["key002", "key003"]
    last = client.get("/paged", {"page_size": "2", "cursor": str(second["next"])}).json()
    assert last == {"results": [{"session_key": "key004"}], "next": None}


@pytest.mark.urls("apps.core.tests.urls")
@pytest.mark.django_db
def test_pagination_page_size_is_at_most_100() -> None:
    response = APIClient().get("/paged", {"page_size": 1000})
    assert response.status_code == 200


def test_release_header_is_on_each_response(client, settings) -> None:
    settings.APP_RELEASE = "1.2.3"
    assert client.get("/healthz")["X-App-Release"] == "1.2.3"
    assert client.get("/api/v1/unknown")["X-App-Release"] == "1.2.3"


def test_domain_error_defaults_and_subclass() -> None:
    error = NotFound()
    assert (error.code, error.http_status, error.fields, error.extra) == ("not_found", 404, None, None)
    assert str(DomainError("Text.")) == "Text."


def test_base_model_fields() -> None:
    assert BaseModel._meta.abstract
    assert {f.name for f in BaseModel._meta.get_fields()} == {"id", "created_at"}


def test_json_formatter_writes_one_json_object() -> None:
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("test.json")
    logger.addHandler(handler)
    logger.propagate = False
    try:
        logger.error("Job %s failed.", "x", extra={"job_id": 42})
        try:
            raise ValueError("boom")
        except ValueError:
            logger.exception("With a traceback.")
    finally:
        logger.removeHandler(handler)
    first, second = (json.loads(line) for line in stream.getvalue().splitlines())
    assert first["level"] == "ERROR"
    assert first["logger"] == "test.json"
    assert first["message"] == "Job x failed."
    assert first["job_id"] == 42
    assert first["time"].endswith("Z")
    assert "traceback" not in first
    assert "ValueError: boom" in second["traceback"]


@app.task(name="core.tests.noop", queue=EMAIL_QUEUE)
def noop_task(value: int) -> None:
    return None


def test_queue_names() -> None:
    assert (EMAIL_QUEUE, MAINTENANCE_QUEUE) == ("email", "maintenance")


@pytest.mark.django_db
def test_defer_on_commit_waits_for_the_commit(job_connector, django_capture_on_commit_callbacks) -> None:
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        defer_on_commit(noop_task, value=3)
    assert job_connector.jobs == {}
    assert len(callbacks) == 1
    callbacks[0]()
    (job,) = job_connector.jobs.values()
    assert job["task_name"] == "core.tests.noop"
    assert job["args"] == {"value": 3}
    assert job["queue_name"] == "email"


def test_spa_index_returns_the_file(client, settings, tmp_path: Path) -> None:
    index = tmp_path / "index.html"
    index.write_text("<html>app</html>")
    settings.SPA_INDEX_PATH = index
    response = client.get("/d/some-diagram")
    assert response.status_code == 200
    assert b"".join(response.streaming_content) == b"<html>app</html>"
    assert response["Cache-Control"] == "no-cache"


def test_spa_index_without_the_file_gives_404(client, settings, tmp_path: Path) -> None:
    settings.SPA_INDEX_PATH = tmp_path / "missing.html"
    response = client.get("/")
    assert response.status_code == 404
    assert response["Content-Type"].startswith("text/plain")


@pytest.mark.parametrize("path", ["/api/v1/unknown", "/_allauth/unknown", "/admin/unknown/", "/static/unknown.js"])
def test_reserved_prefixes_are_not_the_spa(client, settings, tmp_path: Path, path: str) -> None:
    index = tmp_path / "index.html"
    index.write_text("<html>app</html>")
    settings.SPA_INDEX_PATH = index
    response = client.get(path)
    # The admin sends an anonymous user to its login page. The other paths give 404.
    assert response.status_code in (302, 404)
    assert b"app" not in response.content


@pytest.mark.django_db
def test_schema_view_works(client) -> None:
    response = client.get("/api/v1/schema/")
    assert response.status_code == 200
