"""Helpers that make test data for `diagrams`. They use the services and the models of this app only."""

from typing import Any
from uuid import UUID

from rest_framework.test import APIClient

from apps.accounts.api import UserRef
from apps.accounts.testing import force_login, make_user
from apps.diagrams import services
from apps.diagrams.models import Diagram, Share
from apps.workspaces.api import WorkspaceRole
from apps.workspaces.testing import add_member, make_team_workspace

BASE = "/api/v1"


def login(user: UserRef) -> APIClient:
    """A client with a session of the user. It does not examine the CSRF token."""
    client = APIClient()
    force_login(client, user.id)
    return client


def make_diagram(user: UserRef, **kwargs: Any) -> Diagram:
    """Make a diagram in the personal workspace of the user."""
    kwargs.setdefault("name", "Shop")
    return services.create_diagram(user.id, **kwargs).diagram


def user_with_role(diagram: Diagram, role: str) -> UserRef:
    """Make a user who has `role` on the diagram. `role` is a workspace role or `share-viewer` or `share-editor`."""
    user = make_user()
    if role.startswith("share-"):
        Share.objects.create(diagram=diagram, email=user.email.lower(), role=role.removeprefix("share-"))
    else:
        add_member(workspace_id=diagram.workspace_id, user_id=user.id, role=WorkspaceRole(role))
    return user


def team_diagram(owner: UserRef, name: str = "Team diagram") -> Diagram:
    workspace = make_team_workspace()
    return Diagram.objects.create(workspace_id=workspace.id, name=name, created_by_id=owner.id, updated_by_id=owner.id)


def url(diagram_id: UUID | str, suffix: str = "") -> str:
    return f"{BASE}/diagrams/{diagram_id}{suffix}"
