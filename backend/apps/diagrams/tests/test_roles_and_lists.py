"""Tests for the role table (DESIGN.md section 4.3), the list scopes (section 7.9), and `api.py` (section 7.10)."""

import uuid

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.accounts.testing import make_user
from apps.diagrams import api, services
from apps.diagrams.models import Diagram
from apps.diagrams.policy import DiagramRole, effective_role
from apps.diagrams.tests.factories import BASE, login, make_diagram, team_diagram, url, user_with_role
from apps.workspaces.api import WorkspaceRole
from apps.workspaces.testing import add_member

pytestmark = pytest.mark.django_db

RANK = {"viewer": 1, "editor": 2, "owner": 3}

# Source of the role -> diagram role.
SOURCES = {
    "owner": "owner",
    "admin": "owner",
    "editor": "editor",
    "viewer": "viewer",
    "share-editor": "editor",
    "share-viewer": "viewer",
}

# (name, method, suffix, body, minimum role). Section 4.3.
ACTIONS = [
    ("read", "get", "", None, "viewer"),
    ("versions", "get", "/versions", None, "viewer"),
    ("duplicate", "post", "/duplicate", None, "viewer"),
    ("save", "patch", "", {"name": "N"}, "editor"),
    ("named", "post", "/versions", {"label": "L"}, "editor"),
    ("shares-list", "get", "/shares", None, "owner"),
    ("shares-add", "post", "/shares", {"email": "z@example.com", "role": "viewer"}, "owner"),
    ("link-on", "put", "/public-link", None, "owner"),
    ("link-rotate", "post", "/public-link/rotate", None, "owner"),
    ("trash", "delete", "", None, "owner"),
    ("restore", "post", "/restore", None, "owner"),
    ("permanent", "delete", "/permanent", None, "owner"),
]


@pytest.mark.parametrize("source", list(SOURCES))
@pytest.mark.parametrize(("name", "method", "suffix", "body", "minimum"), ACTIONS, ids=[a[0] for a in ACTIONS])
def test_role_table_for_each_action(source, name, method, suffix, body, minimum):
    owner = make_user()
    diagram = make_diagram(owner)
    user = user_with_role(diagram, source)
    expected_role = SOURCES[source]

    response = getattr(login(user), method)(url(diagram.id, suffix), body, format="json", headers={"If-Match": '"1"'})

    if RANK[expected_role] >= RANK[minimum]:
        assert response.status_code not in (403, 404), (source, name, response.content)
    else:
        assert response.status_code == 403, (source, name)
        assert response.json()["error"]["code"] == "diagram_forbidden"


@pytest.mark.parametrize("source", list(SOURCES))
def test_detail_shows_the_effective_role(source):
    diagram = make_diagram(make_user())
    user = user_with_role(diagram, source)
    assert login(user).get(url(diagram.id)).json()["role"] == SOURCES[source]


def test_the_highest_role_wins():
    owner = make_user()
    diagram = make_diagram(owner)
    viewer = user_with_role(diagram, "viewer")
    # A share with a higher role raises the role of a workspace viewer.
    services.add_share(owner.id, diagram.id, email=viewer.email, role="editor")
    assert effective_role(viewer.id, diagram) == DiagramRole.EDITOR
    # A share with a lower role does not lower the role of the workspace owner.
    other = make_user()
    add_member(workspace_id=diagram.workspace_id, user_id=other.id, role=WorkspaceRole.OWNER)
    services.add_share(owner.id, diagram.id, email=other.email, role="viewer")
    assert effective_role(other.id, diagram) == DiagramRole.OWNER


def test_share_email_match_ignores_case():
    owner = make_user()
    diagram = make_diagram(owner)
    services.add_share(owner.id, diagram.id, email="Mixed@Example.com", role="viewer")
    user = make_user(email="MIXED@example.com")
    assert effective_role(user.id, diagram) == DiagramRole.VIEWER


def test_workspace_viewer_cannot_use_a_trash_endpoint_and_owner_admin_can_see_the_team_trash():
    owner = make_user()
    diagram = team_diagram(owner)
    admin = make_user()
    viewer = make_user()
    add_member(workspace_id=diagram.workspace_id, user_id=admin.id, role=WorkspaceRole.ADMIN)
    add_member(workspace_id=diagram.workspace_id, user_id=viewer.id, role=WorkspaceRole.VIEWER)
    Diagram.objects.filter(id=diagram.id).update(trashed_at="2026-01-01T00:00:00Z")

    assert [d["id"] for d in login(admin).get(f"{BASE}/diagrams", {"scope": "trash"}).json()["results"]] == [
        str(diagram.id)
    ]
    assert login(viewer).get(f"{BASE}/diagrams", {"scope": "trash"}).json()["results"] == []
    assert login(viewer).post(url(diagram.id, "/restore")).status_code == 404
    assert login(admin).post(url(diagram.id, "/restore")).status_code == 200


def test_list_scopes():
    me = make_user()
    other = make_user()
    mine = make_diagram(me, name="mine")
    trashed = make_diagram(me, name="trashed")
    services.trash_diagram(me.id, trashed.id)
    theirs = make_diagram(other, name="theirs")
    shared = make_diagram(other, name="shared")
    shared_trashed = make_diagram(other, name="shared-trashed")
    private = make_diagram(other, name="private")
    for diagram in (theirs, shared, shared_trashed):
        services.add_share(other.id, diagram.id, email=me.email, role="viewer")
    services.add_share(other.id, theirs.id, email="x@example.com", role="viewer")
    services.trash_diagram(other.id, shared_trashed.id)
    # A share to a diagram in my own workspace is not "shared with me".
    services.add_share(other.id, private.id, email="z@example.com", role="viewer")
    client = login(me)

    def names(scope):
        response = client.get(f"{BASE}/diagrams", {"scope": scope})
        assert response.status_code == 200
        return {d["name"]: d for d in response.json()["results"]}

    assert set(names("mine")) == {"mine"}
    assert names("mine")["mine"]["role"] == "owner"
    assert set(names("shared")) == {"theirs", "shared"}
    assert names("shared")["shared"]["role"] == "viewer"
    assert set(names("trash")) == {"trashed"}
    assert set(names("mine")) == {mine.name}  # The default scope is the same as `mine`.
    assert set(client.get(f"{BASE}/diagrams").json()["results"][0]) == {
        "id",
        "name",
        "role",
        "change_number",
        "updated_at",
        "updated_by",
        "trashed_at",
    }
    bad = client.get(f"{BASE}/diagrams", {"scope": "all"})
    assert bad.status_code == 400
    assert "scope" in bad.json()["error"]["fields"]


def test_list_is_newest_first_with_cursor_pagination():
    user = make_user()
    ids = [str(make_diagram(user, name=f"d{i}").id) for i in range(5)]
    client = login(user)

    first = client.get(f"{BASE}/diagrams", {"page_size": 2}).json()
    second = client.get(f"{BASE}/diagrams", {"page_size": 2, "cursor": first["next"]}).json()
    third = client.get(f"{BASE}/diagrams", {"page_size": 2, "cursor": second["next"]}).json()

    got = [d["id"] for page in (first, second, third) for d in page["results"]]
    assert got == list(reversed(ids))
    assert third["next"] is None
    assert len(client.get(f"{BASE}/diagrams", {"page_size": 1000}).json()["results"]) == 5


def test_list_loads_users_with_a_fixed_number_of_queries():
    user = make_user()
    for index in range(3):
        make_diagram(user, name=f"d{index}")
    client = login(user)
    with CaptureQueriesContext(connection) as small:
        client.get(f"{BASE}/diagrams")
    for index in range(8):
        other = make_user()
        diagram = make_diagram(user, name=f"x{index}")
        services.add_share(user.id, diagram.id, email=other.email, role="editor")
        services.update_diagram(other.id, diagram.id, expected_change_number=1, name="changed")
    with CaptureQueriesContext(connection) as large:
        response = client.get(f"{BASE}/diagrams")
    assert len(response.json()["results"]) == 11
    assert len(large) == len(small)
    assert response.json()["results"][0]["updated_by"]["id"]


def test_updated_by_is_null_after_the_user_is_gone():
    owner = make_user()
    diagram = team_diagram(owner)
    Diagram.objects.filter(id=diagram.id).update(updated_by_id=None)
    admin = make_user()
    add_member(workspace_id=diagram.workspace_id, user_id=admin.id, role=WorkspaceRole.OWNER)
    assert login(admin).get(url(diagram.id)).json()["updated_by"] is None


def test_api_get_access_and_get_diagram():
    owner = make_user()
    diagram = make_diagram(owner, name="Shop")
    viewer = user_with_role(diagram, "share-viewer")
    stranger = make_user()

    assert api.get_access(owner.id, diagram.id) == api.DiagramRole.OWNER
    assert api.get_access(viewer.id, diagram.id) == api.DiagramRole.VIEWER
    assert api.get_access(stranger.id, diagram.id) is None
    assert api.get_access(None, diagram.id) is None
    assert api.get_access(owner.id, uuid.uuid4()) is None

    ref = api.get_diagram(diagram.id)
    assert (ref.id, ref.workspace_id, ref.name, ref.change_number) == (diagram.id, diagram.workspace_id, "Shop", 1)
    assert ref.updated_at == diagram.updated_at
    with pytest.raises(api.DiagramNotFound):
        api.get_diagram(uuid.uuid4())

    services.trash_diagram(owner.id, diagram.id)
    assert api.get_access(owner.id, diagram.id) is None
    assert api.get_diagram(diagram.id).id == diagram.id
