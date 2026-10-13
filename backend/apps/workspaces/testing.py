"""Test helpers for the tests of other apps (DESIGN.md section 15.1).

v1 has no endpoints for team workspaces (section 17.3). Use these helpers only in tests.
"""

from uuid import UUID

from apps.workspaces.api import WorkspaceRef, WorkspaceRole
from apps.workspaces.models import Member, Workspace


def make_team_workspace(*, name: str = "Team") -> WorkspaceRef:
    workspace = Workspace.objects.create(name=name, kind=Workspace.Kind.TEAM)
    return WorkspaceRef(id=workspace.id, name=workspace.name, kind=workspace.kind)


def add_member(*, workspace_id: UUID, user_id: UUID, role: WorkspaceRole) -> None:
    Member.objects.create(workspace_id=workspace_id, user_id=user_id, role=role.value)
