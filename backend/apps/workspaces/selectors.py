"""Read queries of `workspaces`."""

from uuid import UUID

from apps.workspaces.models import Member


def get_role(user_id: UUID, workspace_id: UUID) -> str | None:
    return Member.objects.filter(user_id=user_id, workspace_id=workspace_id).values_list("role", flat=True).first()


def list_roles_for_user(user_id: UUID) -> dict[UUID, str]:
    return dict(Member.objects.filter(user_id=user_id).values_list("workspace_id", "role"))
