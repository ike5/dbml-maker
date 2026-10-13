"""Spec tests for the requirements VER-*."""

from datetime import UTC, datetime, timedelta

import pytest
from django.utils import timezone

from apps.accounts.testing import make_user
from apps.diagrams import services, tasks
from apps.diagrams.models import Version
from apps.diagrams.tests.factories import BASE, login, make_diagram, url, user_with_role

pytestmark = pytest.mark.django_db

H1 = {"If-Match": '"1"'}


def age_versions(diagram_id, minutes: int) -> None:
    Version.objects.filter(diagram_id=diagram_id).update(created_at=timezone.now() - timedelta(minutes=minutes))


def test_ver_001_editor_makes_a_named_version_from_the_server_copy():
    """VER-001"""
    user = make_user()
    diagram = make_diagram(user, source="Table a {}")
    editor = user_with_role(diagram, "editor")
    client = login(editor)

    response = client.post(url(diagram.id, "/versions"), {"label": "  Release 1  "}, format="json")

    assert response.status_code == 201
    body = response.json()
    assert (body["kind"], body["label"], body["change_number"]) == ("named", "Release 1", 1)
    assert body["created_by"]["id"] == str(editor.id)
    assert "source" not in body
    version = Version.objects.get(id=body["id"])
    assert (version.source, version.layout) == ("Table a {}", diagram.layout)

    detail = client.get(url(diagram.id, f"/versions/{version.id}")).json()
    assert detail["source"] == "Table a {}"
    assert detail["layout"] == {"format": 1, "tables": {}}


def test_ver_001_viewer_cannot_make_a_version_and_the_label_is_necessary():
    """VER-001"""
    user = make_user()
    diagram = make_diagram(user)
    viewer = user_with_role(diagram, "viewer")
    assert login(viewer).post(url(diagram.id, "/versions"), {"label": "x"}, format="json").status_code == 403
    for label in ("", "  ", "L" * 201):
        response = login(user).post(url(diagram.id, "/versions"), {"label": label}, format="json")
        assert response.status_code == 400
        assert "label" in response.json()["error"]["fields"]


def test_ver_002_first_save_makes_an_auto_version_with_the_new_content():
    """VER-002"""
    user = make_user()
    diagram = make_diagram(user)
    client = login(user)

    client.patch(url(diagram.id), {"source": "Table a {}"}, format="json", headers=H1)

    (version,) = Version.objects.filter(diagram=diagram)
    assert (version.kind, version.label, version.source, version.change_number) == ("auto", "", "Table a {}", 2)
    assert version.created_by_id == user.id


def test_ver_002_a_new_auto_version_needs_ten_minutes_and_new_content():
    """VER-002"""
    user = make_user()
    diagram = make_diagram(user)
    client = login(user)
    client.patch(url(diagram.id), {"source": "one"}, format="json", headers=H1)

    # Less than 10 minutes: no new version.
    age_versions(diagram.id, 9)
    client.patch(url(diagram.id), {"source": "two"}, format="json", headers={"If-Match": '"2"'})
    assert Version.objects.filter(diagram=diagram).count() == 1

    # More than 10 minutes, new content: a new version.
    age_versions(diagram.id, 11)
    client.patch(url(diagram.id), {"source": "three"}, format="json", headers={"If-Match": '"3"'})
    assert list(Version.objects.filter(diagram=diagram).order_by("created_at").values_list("source", flat=True)) == [
        "one",
        "three",
    ]

    # More than 10 minutes, same content as the newest version: no new version.
    age_versions(diagram.id, 11)
    client.patch(url(diagram.id), {"name": "Renamed"}, format="json", headers={"If-Match": '"4"'})
    assert Version.objects.filter(diagram=diagram).count() == 2


def test_ver_002_the_time_limit_is_exactly_ten_minutes(monkeypatch):
    """VER-002"""
    user = make_user()
    diagram = make_diagram(user)
    services.update_diagram(user.id, diagram.id, expected_change_number=1, source="one")
    start = Version.objects.get(diagram=diagram).created_at

    monkeypatch.setattr(timezone, "now", lambda: start + timedelta(minutes=10))
    services.update_diagram(user.id, diagram.id, expected_change_number=2, source="two")
    assert Version.objects.filter(diagram=diagram).count() == 1

    monkeypatch.setattr(timezone, "now", lambda: start + timedelta(minutes=10, seconds=1))
    services.update_diagram(user.id, diagram.id, expected_change_number=3, source="three")
    assert Version.objects.filter(diagram=diagram).count() == 2


def test_ver_003_restore_saves_the_version_and_makes_a_restore_version():
    """VER-003"""
    user = make_user()
    diagram = make_diagram(user, source="old")
    named = services.create_named_version(user.id, diagram.id, label="Good state")
    client = login(user)
    client.patch(url(diagram.id), {"source": "new"}, format="json", headers=H1)
    versions_before = Version.objects.filter(diagram=diagram).count()

    response = client.post(url(diagram.id, f"/versions/{named.id}/restore"), headers={"If-Match": '"2"'})

    assert response.status_code == 200
    assert response.json()["source"] == "old"
    assert response.json()["change_number"] == 3
    assert response["ETag"] == '"3"'
    restore = Version.objects.get(diagram=diagram, kind="restore")
    assert (restore.label, restore.source, restore.change_number) == ("Restored from Good state", "old", 3)
    # Nothing was deleted. The restore does not apply the automatic version rule.
    assert Version.objects.filter(diagram=diagram).count() == versions_before + 1
    assert Version.objects.filter(id=named.id).exists()


def test_ver_003_restore_of_an_auto_version_uses_the_date_in_the_label():
    """VER-003"""
    user = make_user()
    diagram = make_diagram(user, source="old")
    services.update_diagram(user.id, diagram.id, expected_change_number=1, source="auto content")
    auto = Version.objects.get(diagram=diagram)
    stamp = datetime(2026, 3, 4, 5, 6, 7, tzinfo=UTC)
    Version.objects.filter(id=auto.id).update(created_at=stamp)

    services.restore_version(user.id, diagram.id, auto.id, expected_change_number=2)

    assert Version.objects.get(diagram=diagram, kind="restore").label == "Restored from 2026-03-04 05:06 UTC"


def test_ver_003_restore_with_an_old_change_number_gets_412_and_needs_if_match():
    """VER-003"""
    user = make_user()
    diagram = make_diagram(user, source="old")
    named = services.create_named_version(user.id, diagram.id, label="v")
    client = login(user)
    path = url(diagram.id, f"/versions/{named.id}/restore")

    assert client.post(path).status_code == 428
    stale = client.post(path, headers={"If-Match": '"7"'})
    assert stale.status_code == 412
    assert stale.json()["error"]["current"]["change_number"] == 1
    assert not Version.objects.filter(diagram=diagram, kind="restore").exists()


def test_ver_003_restore_of_an_unknown_version_gets_404():
    """VER-003"""
    user = make_user()
    diagram = make_diagram(user)
    other = make_diagram(user, name="Other")
    foreign = services.create_named_version(user.id, other.id, label="v")
    client = login(user)
    for version_id in ("0197b6a0-0000-7000-8000-000000000000", str(foreign.id)):
        response = client.post(url(diagram.id, f"/versions/{version_id}/restore"), headers=H1)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "version_not_found"
        assert client.get(url(diagram.id, f"/versions/{version_id}")).status_code == 404


def test_ver_004_job_deletes_old_auto_versions_but_keeps_the_newest_and_the_other_kinds():
    """VER-004"""
    user = make_user()
    busy = make_diagram(user, name="busy")
    quiet = make_diagram(user, name="quiet")
    now = timezone.now()
    old = now - timedelta(days=91)
    recent = now - timedelta(days=89)

    def add(diagram, kind, created_at, label=""):
        version = Version.objects.create(
            diagram=diagram, kind=kind, label=label, source=kind, change_number=1, created_by_id=user.id
        )
        Version.objects.filter(id=version.id).update(created_at=created_at)
        return version.id

    old_auto = add(busy, "auto", old)
    recent_auto = add(busy, "auto", recent)
    old_named = add(busy, "named", old, "n")
    old_restore = add(busy, "restore", old, "r")
    # The only version of a diagram is old, but it is the newest. The job keeps it.
    only_version = add(quiet, "auto", old)

    tasks.purge_old_auto_versions(timestamp=0)

    kept = set(Version.objects.values_list("id", flat=True))
    assert old_auto not in kept
    assert {recent_auto, old_named, old_restore, only_version} <= kept


def test_ver_004_job_keeps_the_newest_auto_version_when_all_versions_are_old():
    """VER-004"""
    user = make_user()
    diagram = make_diagram(user)
    old = timezone.now() - timedelta(days=100)
    ids = []
    for minutes in (3, 2, 1):
        version = Version.objects.create(diagram=diagram, kind="auto", source=str(minutes), change_number=1)
        Version.objects.filter(id=version.id).update(created_at=old + timedelta(minutes=minutes))
        ids.append(version.id)

    tasks.purge_old_auto_versions(timestamp=0)

    assert set(Version.objects.values_list("id", flat=True)) == {ids[0]}


def test_ver_version_list_is_newest_first_and_has_no_source():
    """VER-001"""
    user = make_user()
    diagram = make_diagram(user)
    for label in ("a", "b", "c"):
        services.create_named_version(user.id, diagram.id, label=label)
    client = login(user)

    page = client.get(url(diagram.id, "/versions"), {"page_size": 2}).json()
    assert [v["label"] for v in page["results"]] == ["c", "b"]
    assert all("source" not in v and "layout" not in v for v in page["results"])
    rest = client.get(url(diagram.id, "/versions"), {"page_size": 2, "cursor": page["next"]}).json()
    assert [v["label"] for v in rest["results"]] == ["a"]
    assert rest["next"] is None
    assert client.get(f"{BASE}/diagrams/{diagram.id}/versions").status_code == 200
