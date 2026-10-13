"""The read queries of `diagrams` (DESIGN.md sections 7.9 and 7.11)."""

from collections.abc import Iterable
from uuid import UUID

from django.db.models import QuerySet

from apps.accounts import api as accounts_api
from apps.diagrams.errors import PublicLinkNotFound, VersionNotFound
from apps.diagrams.models import Diagram, PublicLink, Share, Version
from apps.diagrams.policy import DiagramRole, Loaded, effective_roles, require_role
from apps.workspaces import api as workspaces_api

SCOPES = ("mine", "shared", "trash")


def list_diagrams(user_id: UUID, scope: str) -> tuple[QuerySet[Diagram], dict[UUID, workspaces_api.WorkspaceRole]]:
    """Return the diagrams of a list scope (section 7.9) and the workspace roles of the user.

    The view sets the order. The workspace IDs come from `workspaces`, and no query joins its tables.
    """
    workspace_roles = workspaces_api.list_roles_for_user(user_id)
    if scope == "mine":
        queryset = Diagram.objects.filter(workspace_id__in=list(workspace_roles), trashed_at__isnull=True)
    elif scope == "shared":
        email = accounts_api.get_user(user_id).email.lower()
        shared_ids = Share.objects.filter(email=email).values("diagram_id")
        queryset = Diagram.objects.filter(id__in=shared_ids, trashed_at__isnull=True).exclude(
            workspace_id__in=list(workspace_roles)
        )
    else:
        owner_workspaces = [
            workspace_id
            for workspace_id, role in workspace_roles.items()
            if role in (workspaces_api.WorkspaceRole.OWNER, workspaces_api.WorkspaceRole.ADMIN)
        ]
        queryset = Diagram.objects.filter(workspace_id__in=owner_workspaces, trashed_at__isnull=False)
    return queryset, workspace_roles


def roles_of(
    user_id: UUID,
    diagrams: Iterable[Diagram],
    workspace_roles: dict[UUID, workspaces_api.WorkspaceRole],
) -> dict[UUID, DiagramRole | None]:
    return effective_roles(user_id, diagrams, workspace_roles)


def users_by_id(user_ids: Iterable[UUID | None]) -> dict[UUID, accounts_api.UserRef]:
    """Load the users with one call (section 3.5). Unknown and null IDs are not in the result."""
    return accounts_api.get_users({user_id for user_id in user_ids if user_id is not None})


def get_diagram_for(user_id: UUID, diagram_id: UUID) -> Loaded:
    return require_role(user_id, diagram_id, DiagramRole.VIEWER)


def list_versions(user_id: UUID, diagram_id: UUID) -> QuerySet[Version]:
    require_role(user_id, diagram_id, DiagramRole.VIEWER)
    return Version.objects.filter(diagram_id=diagram_id).defer("source", "layout")


def get_version(user_id: UUID, diagram_id: UUID, version_id: UUID) -> Version:
    require_role(user_id, diagram_id, DiagramRole.VIEWER)
    version = Version.objects.filter(id=version_id, diagram_id=diagram_id).first()
    if version is None:
        raise VersionNotFound
    return version


def list_shares(user_id: UUID, diagram_id: UUID) -> list[Share]:
    require_role(user_id, diagram_id, DiagramRole.OWNER)
    return list(Share.objects.filter(diagram_id=diagram_id).order_by("created_at", "id"))


def get_public_link(user_id: UUID, diagram_id: UUID) -> PublicLink | None:
    require_role(user_id, diagram_id, DiagramRole.OWNER)
    return PublicLink.objects.filter(diagram_id=diagram_id).first()


def get_public_diagram(token: str) -> Diagram:
    """Return the diagram of a token. A trash diagram, an off link, and an unknown token look the same (SHR-004)."""
    link = PublicLink.objects.select_related("diagram").filter(token=token).first()
    if link is None or link.diagram.trashed_at is not None:
        raise PublicLinkNotFound
    return link.diagram
