"""Business workflows of `workspaces` (DESIGN.md section 6.2)."""

from uuid import UUID

from django.db import IntegrityError, transaction

from apps.workspaces.models import Member, Workspace


def _find_personal_workspace(user_id: UUID) -> Workspace | None:
    return Workspace.objects.filter(personal_owner_id=user_id).first()


def get_or_create_personal_workspace(user_id: UUID) -> Workspace:
    """Return the personal workspace of the user. Make it, and its owner member, at the first call (WSP-001)."""
    workspace = _find_personal_workspace(user_id)
    if workspace is not None:
        return workspace
    try:
        # The savepoint keeps the outer transaction usable if the unique constraint refuses the insert.
        with transaction.atomic():
            workspace = Workspace.objects.create(
                name="Personal", kind=Workspace.Kind.PERSONAL, personal_owner_id=user_id
            )
            Member.objects.create(workspace=workspace, user_id=user_id, role=Member.Role.OWNER)
    except IntegrityError:
        # A concurrent request made the workspace first. Read the row again.
        return Workspace.objects.get(personal_owner_id=user_id)
    return workspace
