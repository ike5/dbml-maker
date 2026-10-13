"""Public interface of `workspaces` (DESIGN.md section 6.3). Other apps import only this module."""

from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from apps.workspaces import selectors, services
from apps.workspaces.models import Workspace


class WorkspaceRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


@dataclass(frozen=True)
class WorkspaceRef:
    id: UUID
    name: str
    kind: str  # "personal" or "team"


def _to_ref(workspace: Workspace) -> WorkspaceRef:
    return WorkspaceRef(id=workspace.id, name=workspace.name, kind=workspace.kind)


def get_or_create_personal_workspace(user_id: UUID) -> WorkspaceRef:
    return _to_ref(services.get_or_create_personal_workspace(user_id))


def get_role(user_id: UUID, workspace_id: UUID) -> WorkspaceRole | None:
    role = selectors.get_role(user_id, workspace_id)
    return WorkspaceRole(role) if role is not None else None


def list_roles_for_user(user_id: UUID) -> dict[UUID, WorkspaceRole]:
    """Return the role of the user in each workspace.

    The call makes the personal workspace first, because `accounts` cannot call this app at sign-up (section 18.3).
    """
    services.get_or_create_personal_workspace(user_id)
    return {workspace_id: WorkspaceRole(role) for workspace_id, role in selectors.list_roles_for_user(user_id).items()}
