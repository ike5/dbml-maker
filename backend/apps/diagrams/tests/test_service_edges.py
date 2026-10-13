"""Tests for the edge cases of the services that the API tests do not reach."""

import pytest
from django.db import IntegrityError

from apps.accounts.testing import make_user
from apps.core.errors import PayloadTooLarge, ValidationFailed
from apps.diagrams import services
from apps.diagrams.errors import DiagramConflict, DiagramNotFound, ShareExists
from apps.diagrams.models import Diagram, Share
from apps.diagrams.tests.factories import make_diagram

pytestmark = pytest.mark.django_db


def test_dgm_005_services_refuse_a_value_with_a_wrong_type():
    """DGM-005"""
    user = make_user()
    with pytest.raises(ValidationFailed):
        services.create_diagram(user.id, name=5)  # type: ignore[arg-type]
    with pytest.raises(ValidationFailed):
        services.create_diagram(user.id, name="A", source=5)  # type: ignore[arg-type]
    with pytest.raises(ValidationFailed) as error:
        services.create_diagram(user.id, name="A", source="\ud800")
    assert "source" in (error.value.fields or {})
    with pytest.raises(PayloadTooLarge):
        services.create_diagram(user.id, name="A", source="a" * 2_000_000)


def test_dgm_002_conflict_for_a_diagram_that_went_to_the_trash_gives_404():
    """DGM-002"""
    user = make_user()
    diagram = make_diagram(user)
    services.trash_diagram(user.id, diagram.id)
    with pytest.raises(DiagramNotFound):
        services._save(diagram.id, user.id, 1, {"name": "x"})


def test_dgm_002_conflict_body_has_no_user_if_the_updater_is_gone():
    """DGM-002"""
    user = make_user()
    diagram = make_diagram(user)
    Diagram.objects.filter(id=diagram.id).update(updated_by_id=None)
    with pytest.raises(DiagramConflict) as error:
        services.update_diagram(user.id, diagram.id, expected_change_number=9, name="x")
    extra = error.value.extra or {}
    assert extra["current"]["change_number"] == 1
    assert extra["current"]["updated_by"] is None


def test_shr_001_a_race_on_the_unique_share_gives_share_exists(monkeypatch):
    """SHR-001"""
    owner = make_user()
    diagram = make_diagram(owner)

    def fail(*args, **kwargs):
        raise IntegrityError

    monkeypatch.setattr(Share.objects, "create", fail)
    with pytest.raises(ShareExists):
        services.add_share(owner.id, diagram.id, email="a@example.com", role="viewer")
