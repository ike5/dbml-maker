"""Spec tests for OPS-001 (DESIGN.md section 19.2)."""

from unittest import mock

import pytest
from django.db import OperationalError


def test_ops_001_healthz_gives_200_without_the_database(client) -> None:
    """OPS-001: `/healthz` gives 200 while the process runs."""
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_ops_001_readyz_gives_200_when_the_database_answers(client) -> None:
    """OPS-001: `/readyz` gives 200 if the database answers `SELECT 1`."""
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ops_001_readyz_gives_503_when_the_database_fails(client) -> None:
    """OPS-001: `/readyz` gives 503 if the database does not answer."""
    with mock.patch("apps.core.views.connection") as connection:
        connection.cursor.side_effect = OperationalError("down")
        response = client.get("/readyz")
    assert response.status_code == 503
    assert response.json() == {"status": "database_unavailable"}
