"""Spec tests for the requirements SEC-001, SEC-004, SEC-005, and AUTH-005."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.testing import force_login, make_user
from apps.diagrams import services
from apps.diagrams.models import Diagram, PublicLink, Share, Version
from apps.diagrams.tests.factories import BASE, login, make_diagram, team_diagram, url

pytestmark = pytest.mark.django_db

FAKE_ID = "0197b6a0-0000-7000-8000-000000000000"
H1 = {"If-Match": '"1"'}

# (method, suffix, body). `{v}` is a version ID and `{s}` is a share ID.
ENDPOINTS = [
    ("get", "", None),
    ("patch", "", {"name": "x"}),
    ("delete", "", None),
    ("post", "/restore", None),
    ("delete", "/permanent", None),
    ("post", "/duplicate", None),
    ("get", "/versions", None),
    ("post", "/versions", {"label": "x"}),
    ("get", "/versions/{v}", None),
    ("post", "/versions/{v}/restore", None),
    ("get", "/shares", None),
    ("post", "/shares", {"email": "x@example.com", "role": "viewer"}),
    ("patch", "/shares/{s}", {"role": "viewer"}),
    ("delete", "/shares/{s}", None),
    ("get", "/public-link", None),
    ("put", "/public-link", None),
    ("delete", "/public-link", None),
    ("post", "/public-link/rotate", None),
]


def call(client: APIClient, diagram_id, method: str, suffix: str, body, version_id=FAKE_ID, share_id=FAKE_ID):
    path = url(diagram_id, suffix.format(v=version_id, s=share_id))
    return getattr(client, method)(path, body, format="json", headers=H1)


@pytest.mark.parametrize(("method", "suffix", "body"), ENDPOINTS)
def test_sec_004_user_without_a_role_gets_404_not_403(method, suffix, body):
    """SEC-004"""
    owner = make_user()
    diagram = make_diagram(owner)
    services.create_named_version(owner.id, diagram.id, label="v")
    stranger = login(make_user())

    response = call(stranger, diagram.id, method, suffix, body)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "diagram_not_found"

    # A diagram that does not exist gives the same answer.
    missing = call(stranger, FAKE_ID, method, suffix, body)
    assert missing.status_code == 404
    assert missing.json() == response.json()


@pytest.mark.parametrize(("method", "suffix", "body"), ENDPOINTS)
def test_sec_004_member_of_a_different_workspace_gets_404(method, suffix, body):
    """SEC-004"""
    owner = make_user()
    diagram = team_diagram(owner)
    response = call(login(owner), diagram.id, method, suffix, body)
    assert response.status_code == 404


@pytest.mark.parametrize(
    ("method", "suffix", "body"),
    [e for e in ENDPOINTS if e[1] not in ("/restore", "/permanent")],
)
def test_sec_004_diagram_in_the_trash_gives_404_to_the_owner_and_to_shared_users(method, suffix, body):
    """SEC-004"""
    owner = make_user()
    friend = make_user()
    diagram = make_diagram(owner)
    services.add_share(owner.id, diagram.id, email=friend.email, role="editor")
    services.trash_diagram(owner.id, diagram.id)

    for user in (owner, friend):
        response = call(login(user), diagram.id, method, suffix, body)
        assert response.status_code == 404, user
        assert response.json()["error"]["code"] == "diagram_not_found"


def test_sec_004_shared_user_cannot_restore_or_delete_a_trash_diagram():
    """SEC-004"""
    owner = make_user()
    friend = make_user()
    diagram = make_diagram(owner)
    services.add_share(owner.id, diagram.id, email=friend.email, role="editor")
    services.trash_diagram(owner.id, diagram.id)
    client = login(friend)
    assert client.post(url(diagram.id, "/restore")).status_code == 404
    assert client.delete(url(diagram.id, "/permanent")).status_code == 404


def test_sec_004_anonymous_requests_get_401():
    """SEC-004"""
    diagram = make_diagram(make_user())
    anonymous = APIClient()
    assert anonymous.get(f"{BASE}/diagrams").status_code == 401
    assert anonymous.get(url(diagram.id)).status_code == 401
    assert anonymous.post(f"{BASE}/public/token/duplicate").status_code == 401


def test_sec_004_a_role_that_is_too_low_gets_403():
    """SEC-004"""
    owner = make_user()
    diagram = make_diagram(owner)
    services.add_share(owner.id, diagram.id, email="v@example.com", role="viewer")
    viewer = login(make_user(email="v@example.com"))
    response = viewer.delete(url(diagram.id))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "diagram_forbidden"


def test_sec_001_write_without_the_csrf_token_gets_403(csrf_client):
    """SEC-001"""
    user = make_user()
    diagram = make_diagram(user)
    force_login(csrf_client, user.id)

    for method, path, body in (
        ("post", f"{BASE}/diagrams", {"name": "x"}),
        ("patch", url(diagram.id), {"name": "x"}),
        ("put", url(diagram.id, "/public-link"), None),
        ("delete", url(diagram.id), None),
        ("post", f"{BASE}/public/token/duplicate", None),
    ):
        response = getattr(csrf_client, method)(path, body, format="json", headers=H1)
        assert response.status_code == 403, (method, path)
        assert response.json()["error"]["code"] == "permission_denied"
    diagram.refresh_from_db()
    assert (diagram.name, diagram.trashed_at) == ("Shop", None)


def test_sec_005_share_requests_are_throttled():
    """SEC-005"""
    owner = make_user()
    diagram = make_diagram(owner)
    client = login(owner)
    path = url(diagram.id, "/shares")

    for number in range(30):
        response = client.post(path, {"email": f"u{number}@example.com", "role": "viewer"}, format="json")
        assert response.status_code == 201, number
    blocked = client.post(path, {"email": "last@example.com", "role": "viewer"}, format="json")

    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "throttled"
    assert "Retry-After" in blocked
    # The list is not counted.
    assert client.get(path).status_code == 200


def test_sec_005_public_reads_are_throttled_by_ip_address_also_for_logged_in_users():
    """SEC-005"""
    owner = make_user()
    diagram = make_diagram(owner)
    token = login(owner).put(url(diagram.id, "/public-link")).json()["token"]
    path = f"{BASE}/public/{token}"
    anonymous = APIClient()

    for number in range(60):
        assert anonymous.get(path).status_code == 200, number
    assert anonymous.get(path).status_code == 429

    # The same IP address with a login still counts against the same limit.
    assert login(owner).get(path).status_code == 429
    # A different IP address has its own limit.
    other = APIClient(REMOTE_ADDR="10.9.8.7")
    assert other.get(path).status_code == 200


def test_auth_005_user_delete_deletes_the_personal_diagrams():
    """AUTH-005"""
    owner = make_user()
    friend = make_user()
    personal = make_diagram(owner, name="Personal")
    services.update_diagram(owner.id, personal.id, expected_change_number=1, source="x")
    services.create_named_version(owner.id, personal.id, label="v")
    services.add_share(owner.id, personal.id, email=friend.email, role="viewer")
    services.enable_public_link(owner.id, personal.id)
    team = team_diagram(owner)
    Share.objects.create(diagram=team, email="x@example.com", role="viewer")
    assert Version.objects.filter(diagram=personal).count() == 2

    get_user_model().objects.get(id=owner.id).delete()

    assert not Diagram.objects.filter(id=personal.id).exists()
    assert not Version.objects.filter(diagram_id=personal.id).exists()
    assert not Share.objects.filter(diagram_id=personal.id).exists()
    assert not PublicLink.objects.filter(diagram_id=personal.id).exists()
    team.refresh_from_db()
    assert (team.created_by_id, team.updated_by_id) == (None, None)
    assert Share.objects.filter(diagram=team).exists()
