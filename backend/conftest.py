"""Shared pytest fixtures (DESIGN.md section 15.1)."""

from collections.abc import Iterator

import pytest
from procrastinate.testing import InMemoryConnector
from rest_framework.test import APIClient

from apps.core.jobs import app as job_app


@pytest.fixture(autouse=True)
def job_connector() -> Iterator[InMemoryConnector]:
    """Replace the job queue with an in-memory queue for each test.

    A test reads `job_connector.jobs` to see which jobs a service enqueued.
    """
    connector = InMemoryConnector()
    with job_app.replace_connector(connector):
        yield connector
    connector.reset()


@pytest.fixture
def api_client() -> APIClient:
    """A client that does not examine the CSRF token, like a test client of Django."""
    return APIClient()


@pytest.fixture
def csrf_client() -> APIClient:
    """A client that examines the CSRF token, like a browser (SEC-001)."""
    return APIClient(enforce_csrf_checks=True)
