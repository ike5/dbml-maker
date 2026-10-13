"""Spec tests for the requirements SHR-*."""

import pytest
from rest_framework.test import APIClient

from apps.accounts.testing import make_user
from apps.comms.testing import list_outbound_emails
from apps.diagrams import services
from apps.diagrams.models import Share
from apps.diagrams.tests.factories import BASE, login, make_diagram, url

pytestmark = pytest.mark.django_db

H1 = {"If-Match": '"1"'}


def test_shr_001_owner_shares_with_an_address_and_the_share_gives_the_role():
    """SHR-001"""
    owner = make_user()
    friend = make_user(email="friend@example.com")
    diagram = make_diagram(owner, source="Table a {}")
    client = login(owner)

    response = client.post(url(diagram.id, "/shares"), {"email": "Friend@Example.COM", "role": "viewer"}, format="json")

    assert response.status_code == 201
    body = response.json()
    assert (body["email"], body["role"]) == ("friend@example.com", "viewer")
    assert set(body) == {"id", "email", "role", "created_at"}

    friend_client = login(friend)
    assert friend_client.get(url(diagram.id)).json()["role"] == "viewer"
    assert friend_client.patch(url(diagram.id), {"name": "x"}, format="json", headers=H1).status_code == 403
    listing = friend_client.get(f"{BASE}/diagrams", {"scope": "shared"}).json()
    assert [d["id"] for d in listing["results"]] == [str(diagram.id)]
    assert listing["results"][0]["role"] == "viewer"

    shares = client.get(url(diagram.id, "/shares")).json()
    assert shares == {"results": [body], "next": None}

    changed = client.patch(url(diagram.id, f"/shares/{body['id']}"), {"role": "editor"}, format="json")
    assert changed.json()["role"] == "editor"
    assert friend_client.patch(url(diagram.id), {"name": "x"}, format="json", headers=H1).status_code == 200

    assert client.delete(url(diagram.id, f"/shares/{body['id']}")).status_code == 204
    assert friend_client.get(url(diagram.id)).status_code == 404


def test_shr_001_share_notice_email_has_the_key_and_the_text():
    """SHR-001"""
    owner = make_user(display_name="Ann Owner", email="ann@example.com")
    diagram = make_diagram(owner, name="Shop <db> & more")

    share = services.add_share(owner.id, diagram.id, email="New@Example.com", role="editor")

    (email,) = list_outbound_emails(to="new@example.com")
    assert email.key == f"share-notice:{share.id}"
    assert email.subject == "A diagram was shared with you"
    assert "Ann Owner shared a diagram with you." in email.body
    # The template does not escape the text, because the email is plain text.
    assert "Diagram: Shop <db> & more" in email.body
    assert "Your role: editor" in email.body
    assert f"http://testserver/d/{diagram.id}" in email.body
    assert "http://testserver/signup" in email.body


def test_shr_001_share_notice_names_the_address_if_the_sharer_has_no_display_name():
    """SHR-001"""
    owner = make_user(email="ann@example.com")
    diagram = make_diagram(owner)
    services.add_share(owner.id, diagram.id, email="friend@example.com", role="viewer")
    assert list_outbound_emails(to="friend@example.com")[0].body.startswith("ann@example.com shared a diagram")


def test_shr_001_share_rules():
    """SHR-001"""
    owner = make_user(email="ann@example.com")
    diagram = make_diagram(owner)
    client = login(owner)
    path = url(diagram.id, "/shares")

    self_share = client.post(path, {"email": "ANN@example.com", "role": "viewer"}, format="json")
    assert self_share.status_code == 400
    assert self_share.json()["error"]["code"] == "share_self"

    assert client.post(path, {"email": "a@example.com", "role": "viewer"}, format="json").status_code == 201
    duplicate = client.post(path, {"email": "A@example.com", "role": "editor"}, format="json")
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "share_exists"

    for body in (
        {"email": "bad", "role": "viewer"},
        {"email": "b@example.com", "role": "owner"},
        {"email": "b@example.com"},
    ):
        response = client.post(path, body, format="json")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_failed"

    assert Share.objects.filter(diagram=diagram).count() == 1
    assert len(list_outbound_emails()) == 1


def test_shr_001_share_limit(settings):
    """SHR-001"""
    settings.DIAGRAM_MAX_SHARES = 2
    owner = make_user()
    diagram = make_diagram(owner)
    client = login(owner)
    path = url(diagram.id, "/shares")
    for name in ("a", "b"):
        assert client.post(path, {"email": f"{name}@example.com", "role": "viewer"}, format="json").status_code == 201
    response = client.post(path, {"email": "c@example.com", "role": "viewer"}, format="json")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "share_limit"


def test_shr_001_unknown_share_gets_404():
    """SHR-001"""
    owner = make_user()
    diagram = make_diagram(owner)
    other = make_diagram(owner, name="Other")
    foreign = services.add_share(owner.id, other.id, email="x@example.com", role="viewer")
    client = login(owner)
    for share_id in ("0197b6a0-0000-7000-8000-000000000000", str(foreign.id)):
        patch = client.patch(url(diagram.id, f"/shares/{share_id}"), {"role": "viewer"}, format="json")
        assert patch.status_code == 404
        assert patch.json()["error"]["code"] == "share_not_found"
        assert client.delete(url(diagram.id, f"/shares/{share_id}")).status_code == 404


def test_shr_002_owner_turns_on_the_public_link_and_it_gives_viewer_access_only():
    """SHR-002"""
    owner = make_user()
    diagram = make_diagram(owner, name="Shop", source="Table a {}")
    client = login(owner)
    path = url(diagram.id, "/public-link")

    assert client.get(path).json() == {"enabled": False, "token": None, "url": None, "created_at": None}

    first = client.put(path)
    assert first.status_code == 200
    body = first.json()
    assert body["enabled"] is True
    assert len(body["token"]) >= 43
    assert body["url"] == f"http://testserver/s/{body['token']}"
    # A second PUT returns the same link.
    assert client.put(path).json() == body
    assert client.get(path).json() == body

    anonymous = APIClient()
    public = anonymous.get(f"{BASE}/public/{body['token']}")
    assert public.status_code == 200
    data = public.json()
    assert data["name"] == "Shop"
    assert data["source"] == "Table a {}"
    assert data["layout"] == {"format": 1, "tables": {}}
    assert data["updated_at"].endswith("Z")
    assert set(data) == {"name", "source", "layout", "updated_at"}
    # The link gives no access to the diagram endpoints.
    assert anonymous.get(url(diagram.id)).status_code == 401
    assert login(make_user()).get(url(diagram.id)).status_code == 404


def test_shr_003_rotate_stops_the_old_url_at_once():
    """SHR-003"""
    owner = make_user()
    diagram = make_diagram(owner)
    client = login(owner)
    old = client.put(url(diagram.id, "/public-link")).json()

    rotated = client.post(url(diagram.id, "/public-link/rotate"))

    assert rotated.status_code == 200
    new = rotated.json()
    assert new["token"] != old["token"]
    assert client.get(f"{BASE}/public/{old['token']}").status_code == 404
    assert client.get(f"{BASE}/public/{new['token']}").status_code == 200


def test_shr_003_rotate_with_the_link_off_gets_409():
    """SHR-003"""
    owner = make_user()
    diagram = make_diagram(owner)
    response = login(owner).post(url(diagram.id, "/public-link/rotate"))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "public_link_off"


def test_shr_004_turn_off_makes_the_old_url_give_404():
    """SHR-004"""
    owner = make_user()
    diagram = make_diagram(owner)
    client = login(owner)
    token = client.put(url(diagram.id, "/public-link")).json()["token"]

    assert client.delete(url(diagram.id, "/public-link")).status_code == 204
    # A second delete is not an error.
    assert client.delete(url(diagram.id, "/public-link")).status_code == 204

    response = APIClient().get(f"{BASE}/public/{token}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "public_link_not_found"
    assert client.get(url(diagram.id, "/public-link")).json()["enabled"] is False


def test_shr_004_trash_and_unknown_token_give_the_same_404():
    """SHR-004"""
    owner = make_user()
    diagram = make_diagram(owner)
    client = login(owner)
    token = client.put(url(diagram.id, "/public-link")).json()["token"]
    client.delete(url(diagram.id))

    trashed = APIClient().get(f"{BASE}/public/{token}")
    unknown = APIClient().get(f"{BASE}/public/unknown-token")
    assert trashed.status_code == unknown.status_code == 404
    assert trashed.json() == unknown.json()

    # The link works again after a restore.
    client.post(url(diagram.id, "/restore"))
    assert APIClient().get(f"{BASE}/public/{token}").status_code == 200


def test_shr_public_duplicate_needs_a_login_and_copies_the_content():
    """SHR-002"""
    owner = make_user()
    diagram = make_diagram(owner, name="Shop", source="Table a {}")
    token = login(owner).put(url(diagram.id, "/public-link")).json()["token"]
    path = f"{BASE}/public/{token}/duplicate"

    assert APIClient().post(path).status_code == 401

    visitor = make_user()
    response = login(visitor).post(path)
    assert response.status_code == 201
    body = response.json()
    assert (body["name"], body["source"], body["role"], body["change_number"]) == (
        "Copy of Shop",
        "Table a {}",
        "owner",
        1,
    )
    assert login(visitor).get(url(body["id"])).status_code == 200
    assert login(visitor).post(f"{BASE}/public/unknown/duplicate").status_code == 404


def test_shr_005_response_does_not_tell_if_an_account_exists():
    """SHR-005"""
    owner = make_user()
    make_user(email="known@example.com")
    diagram = make_diagram(owner)
    client = login(owner)

    known = client.post(url(diagram.id, "/shares"), {"email": "known@example.com", "role": "viewer"}, format="json")
    unknown = client.post(url(diagram.id, "/shares"), {"email": "nobody@example.com", "role": "viewer"}, format="json")

    assert known.status_code == unknown.status_code == 201
    assert set(known.json()) == set(unknown.json())
    # Both addresses get a notice with the same subject.
    assert (
        list_outbound_emails(to="known@example.com")[0].subject
        == list_outbound_emails(to="nobody@example.com")[0].subject
    )


def test_shr_share_for_a_user_who_signs_up_later_gives_access():
    """SHR-001"""
    owner = make_user()
    diagram = make_diagram(owner)
    services.add_share(owner.id, diagram.id, email="later@example.com", role="editor")
    later = make_user(email="Later@Example.com")
    assert login(later).get(url(diagram.id)).json()["role"] == "editor"
