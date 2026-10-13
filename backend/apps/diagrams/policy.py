"""The access policy of `diagrams` (DESIGN.md sections 4.3 and 4.4).

`effective_role` and `effective_roles` are the only functions that calculate the role of a user on a diagram.
"""

from collections.abc import Iterable
from enum import StrEnum
from typing import NamedTuple
from uuid import UUID

from apps.accounts import api as accounts_api
from apps.diagrams.errors import DiagramForbidden, DiagramNotFound
from apps.diagrams.models import Diagram, Share
from apps.workspaces import api as workspaces_api


class DiagramRole(StrEnum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


_RANK = {DiagramRole.VIEWER: 1, DiagramRole.EDITOR: 2, DiagramRole.OWNER: 3}

_FROM_WORKSPACE = {
    workspaces_api.WorkspaceRole.OWNER: DiagramRole.OWNER,
    workspaces_api.WorkspaceRole.ADMIN: DiagramRole.OWNER,
    workspaces_api.WorkspaceRole.EDITOR: DiagramRole.EDITOR,
    workspaces_api.WorkspaceRole.VIEWER: DiagramRole.VIEWER,
}


class Loaded(NamedTuple):
    """A diagram and the role of the caller on it."""

    diagram: Diagram
    role: DiagramRole


def has_at_least(role: DiagramRole, minimum: DiagramRole) -> bool:
    return _RANK[role] >= _RANK[minimum]


def _highest(*roles: DiagramRole | None) -> DiagramRole | None:
    found = [role for role in roles if role is not None]
    return max(found, key=_RANK.__getitem__, default=None)


def _from_workspace(role: workspaces_api.WorkspaceRole | None) -> DiagramRole | None:
    return _FROM_WORKSPACE[role] if role is not None else None


def effective_roles(
    user_id: UUID,
    diagrams: Iterable[Diagram],
    workspace_roles: dict[UUID, workspaces_api.WorkspaceRole] | None = None,
) -> dict[UUID, DiagramRole | None]:
    """Return the role of the user on each diagram. Two queries and one call to `workspaces`, for any count."""
    diagram_list = list(diagrams)
    if workspace_roles is None:
        workspace_roles = workspaces_api.list_roles_for_user(user_id)
    # A share gives no access while the diagram is in the trash (section 7.7).
    shareable = [d.id for d in diagram_list if d.trashed_at is None]
    share_roles: dict[UUID, DiagramRole] = {}
    if shareable:
        email = accounts_api.get_user(user_id).email.lower()
        for diagram_id, role in Share.objects.filter(diagram_id__in=shareable, email=email).values_list(
            "diagram_id", "role"
        ):
            share_roles[diagram_id] = DiagramRole(role)
    return {
        d.id: _highest(_from_workspace(workspace_roles.get(d.workspace_id)), share_roles.get(d.id))
        for d in diagram_list
    }


def effective_role(user_id: UUID, diagram: Diagram) -> DiagramRole | None:
    """Return the highest role of the user on the diagram, or `None` if the user has no role."""
    return _highest(
        _from_workspace(workspaces_api.get_role(user_id, diagram.workspace_id)),
        _share_role(user_id, diagram),
    )


def _share_role(user_id: UUID, diagram: Diagram) -> DiagramRole | None:
    if diagram.trashed_at is not None:
        return None
    email = accounts_api.get_user(user_id).email.lower()
    role = Share.objects.filter(diagram_id=diagram.id, email=email).values_list("role", flat=True).first()
    return DiagramRole(role) if role is not None else None


def require_role(
    user_id: UUID,
    diagram_id: UUID,
    minimum: DiagramRole,
    *,
    allow_trashed: bool = False,
) -> Loaded:
    """Return the diagram and the role, or raise `DiagramNotFound` (SEC-004) or `DiagramForbidden`.

    A diagram in the trash is visible only to its owners, and only if the caller sets `allow_trashed`.
    """
    diagram = Diagram.objects.filter(id=diagram_id).first()
    if diagram is None:
        raise DiagramNotFound
    role = effective_role(user_id, diagram)
    if role is None:
        raise DiagramNotFound
    if diagram.trashed_at is not None and (not allow_trashed or role != DiagramRole.OWNER):
        raise DiagramNotFound
    if not has_at_least(role, minimum):
        raise DiagramForbidden
    return Loaded(diagram, role)
