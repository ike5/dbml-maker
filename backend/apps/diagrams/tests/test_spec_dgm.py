"""Spec tests for the requirements DGM-*."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.testing import make_user
from apps.diagrams import services, tasks
from apps.diagrams.models import Diagram
from apps.diagrams.tests.factories import BASE, login, make_diagram, url

pytestmark = pytest.mark.django_db

LAYOUT = {"format": 1, "tables": {"public.users": {"x": 1, "y": 2.5}}}


def test_dgm_001_user_can_make_open_rename_and_duplicate_a_diagram():
    """DGM-001"""
    user = make_user(display_name="Ann")
    client = login(user)

    response = client.post(f"{BASE}/diagrams", {"name": "  Shop  "}, format="json")
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Shop"
    assert body["source"] == ""
    assert body["layout"] == {"format": 1, "tables": {}}
    assert body["change_number"] == 1
    assert body["role"] == "owner"
    assert body["trashed_at"] is None
    assert body["updated_by"] == {"id": str(user.id), "email": user.email, "display_name": "Ann"}
    assert response["ETag"] == '"1"'

    diagram_id = body["id"]
    opened = client.get(url(diagram_id))
    assert opened.status_code == 200
    assert opened.json() == body
    assert opened["ETag"] == '"1"'

    renamed = client.patch(url(diagram_id), {"name": "Store"}, format="json", headers={"If-Match": '"1"'})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Store"
    assert renamed["ETag"] == '"2"'

    copy = client.post(url(diagram_id, "/duplicate"))
    assert copy.status_code == 201
    assert copy.json()["name"] == "Copy of Store"
    assert copy.json()["id"] != diagram_id
    assert copy.json()["change_number"] == 1


def test_dgm_001_duplicate_cuts_the_name_and_copies_no_versions_shares_or_link():
    """DGM-001"""
    user = make_user()
    diagram = make_diagram(user, name="N" * 200, source="Table a {}", layout=LAYOUT)
    services.create_named_version(user.id, diagram.id, label="v1")
    services.add_share(user.id, diagram.id, email="friend@example.com", role="viewer")
    services.enable_public_link(user.id, diagram.id)

    copy = services.duplicate_diagram(user.id, diagram.id).diagram

    assert copy.name == "Copy of " + "N" * 192
    assert (copy.source, copy.layout, copy.change_number) == ("Table a {}", LAYOUT, 1)
    assert not copy.versions.exists()
    assert not copy.shares.exists()
    assert not hasattr(copy, "public_link")


def test_dgm_002_old_change_number_gets_412():
    """DGM-002"""
    user = make_user(display_name="Ann")
    other = make_user()
    diagram = make_diagram(user)
    client = login(user)
    other_client = login(other)
    # The other user gets the editor role through a share.
    services.add_share(user.id, diagram.id, email=other.email, role="editor")

    ok = other_client.patch(url(diagram.id), {"source": "a"}, format="json", headers={"If-Match": '"1"'})
    assert ok.status_code == 200

    stale = client.patch(url(diagram.id), {"source": "b"}, format="json", headers={"If-Match": '"1"'})
    assert stale.status_code == 412
    error = stale.json()["error"]
    assert error["code"] == "diagram_conflict"
    assert error["current"]["change_number"] == 2
    assert error["current"]["updated_by"]["id"] == str(other.id)
    assert error["current"]["updated_at"].endswith("Z")
    diagram.refresh_from_db()
    assert diagram.source == "a"


def test_dgm_002_if_match_is_necessary_and_can_have_no_quotes():
    """DGM-002"""
    user = make_user()
    diagram = make_diagram(user)
    client = login(user)

    missing = client.patch(url(diagram.id), {"source": "a"}, format="json")
    assert missing.status_code == 428
    assert missing.json()["error"]["code"] == "precondition_required"

    for bad in ("abc", '"x"', "-1", "", "99999999999"):
        response = client.patch(url(diagram.id), {"source": "a"}, format="json", headers={"If-Match": bad})
        assert response.status_code == 400, bad
        assert response.json()["error"]["code"] == "invalid_if_match"

    plain = client.patch(url(diagram.id), {"source": "a"}, format="json", headers={"If-Match": "1"})
    assert plain.status_code == 200


def test_dgm_002_patch_with_no_field_gets_400():
    """DGM-002"""
    user = make_user()
    diagram = make_diagram(user)
    response = login(user).patch(url(diagram.id), {}, format="json", headers={"If-Match": '"1"'})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_failed"


def test_dgm_003_source_is_kept_exactly():
    """DGM-003"""
    user = make_user()
    client = login(user)
    source = "\n\n  Table users {\r\n\tid int  \r\n}\né中\U0001f600   \n\n"
    created = client.post(f"{BASE}/diagrams", {"name": "A", "source": source}, format="json").json()
    assert created["source"] == source
    assert Diagram.objects.get(id=created["id"]).source == source

    changed = "  Table  a { }  \r\n"
    response = client.patch(url(created["id"]), {"source": changed}, format="json", headers={"If-Match": '"1"'})
    assert response.json()["source"] == changed
    assert client.get(url(created["id"])).json()["source"] == changed


def test_dgm_004_delete_moves_to_trash_and_the_owner_can_restore():
    """DGM-004"""
    user = make_user()
    diagram = make_diagram(user)
    client = login(user)

    assert client.delete(url(diagram.id)).status_code == 204
    diagram.refresh_from_db()
    assert diagram.trashed_at is not None

    # A diagram in the trash is not visible, also to the owner (section 4.4).
    assert client.get(url(diagram.id)).status_code == 404
    assert client.patch(url(diagram.id), {"name": "x"}, format="json", headers={"If-Match": '"1"'}).status_code == 404
    listing = client.get(f"{BASE}/diagrams", {"scope": "trash"}).json()
    assert [d["id"] for d in listing["results"]] == [str(diagram.id)]
    assert listing["results"][0]["trashed_at"].endswith("Z")
    assert client.get(f"{BASE}/diagrams").json()["results"] == []

    restored = client.post(url(diagram.id, "/restore"))
    assert restored.status_code == 200
    assert restored.json()["trashed_at"] is None
    assert client.get(url(diagram.id)).status_code == 200
    # A restore of a diagram that is not in the trash changes nothing.
    assert client.post(url(diagram.id, "/restore")).status_code == 200


def test_dgm_004_permanent_delete_needs_the_trash():
    """DGM-004"""
    user = make_user()
    diagram = make_diagram(user)
    services.create_named_version(user.id, diagram.id, label="v")
    client = login(user)

    refused = client.delete(url(diagram.id, "/permanent"))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "diagram_not_in_trash"

    client.delete(url(diagram.id))
    assert client.delete(url(diagram.id, "/permanent")).status_code == 204
    assert not Diagram.objects.filter(id=diagram.id).exists()


def test_dgm_004_the_job_deletes_old_trash():
    """DGM-004"""
    user = make_user()
    old, recent, active = (make_diagram(user, name=n) for n in ("old", "recent", "active"))
    now = timezone.now()
    Diagram.objects.filter(id=old.id).update(trashed_at=now - timedelta(days=31))
    Diagram.objects.filter(id=recent.id).update(trashed_at=now - timedelta(days=29))

    tasks.purge_trash(timestamp=0)

    assert set(Diagram.objects.values_list("id", flat=True)) == {recent.id, active.id}


def test_dgm_005_name_rules():
    """DGM-005"""
    client = login(make_user())
    for name in ("", "   ", "N" * 201):
        response = client.post(f"{BASE}/diagrams", {"name": name}, format="json")
        assert response.status_code == 400, name
        assert response.json()["error"]["code"] == "validation_failed"
        assert "name" in response.json()["error"]["fields"]
    assert client.post(f"{BASE}/diagrams", {}, format="json").status_code == 400
    assert client.post(f"{BASE}/diagrams", {"name": "N" * 200}, format="json").status_code == 201
    # The strip happens first.
    assert client.post(f"{BASE}/diagrams", {"name": " " + "N" * 200 + " "}, format="json").status_code == 201


def test_dgm_005_source_larger_than_1_mib_gets_413():
    """DGM-005"""
    user = make_user()
    client = login(user)
    limit = 1_048_576
    response = client.post(f"{BASE}/diagrams", {"name": "A", "source": "a" * (limit + 1)}, format="json")
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "source_too_large"

    # The limit counts UTF-8 bytes, not characters.
    wide = "é" * (limit // 2 + 1)
    assert client.post(f"{BASE}/diagrams", {"name": "A", "source": wide}, format="json").status_code == 413

    ok = client.post(f"{BASE}/diagrams", {"name": "A", "source": "a" * limit}, format="json")
    assert ok.status_code == 201

    diagram = make_diagram(user)
    too_large = client.patch(url(diagram.id), {"source": "a" * (limit + 1)}, format="json", headers={"If-Match": '"1"'})
    assert too_large.status_code == 413


def test_dgm_005_layout_larger_than_256_kib_gets_413():
    """DGM-005"""
    client = login(make_user())
    tables = {f"public.table_{i:05d}": {"x": 1, "y": 2} for i in range(8000)}
    response = client.post(f"{BASE}/diagrams", {"name": "A", "layout": {"format": 1, "tables": tables}}, format="json")
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "layout_too_large"


def test_dgm_005_wrong_layout_gets_400():
    """DGM-005"""
    client = login(make_user())
    response = client.post(f"{BASE}/diagrams", {"name": "A", "layout": {"format": 2, "tables": {}}}, format="json")
    assert response.status_code == 400
    assert "layout" in response.json()["error"]["fields"]
