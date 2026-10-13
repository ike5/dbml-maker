"""Public interface of `diagrams` (DESIGN.md section 7.10). Other apps import only this module."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from apps.diagrams.errors import DiagramNotFound
from apps.diagrams.models import Diagram
from apps.diagrams.policy import DiagramRole, effective_role

__all__ = ["DiagramNotFound", "DiagramRef", "DiagramRole", "get_access", "get_diagram"]


@dataclass(frozen=True)
class DiagramRef:
    id: UUID
    workspace_id: UUID
    name: str
    change_number: int
    updated_at: datetime


def get_access(user_id: UUID | None, diagram_id: UUID) -> DiagramRole | None:
    """Return the role of the user, or `None` if the user has no access. A diagram in the trash gives no access."""
    if user_id is None:
        return None
    diagram = Diagram.objects.filter(id=diagram_id).first()
    if diagram is None or diagram.trashed_at is not None:
        return None
    return effective_role(user_id, diagram)


def get_diagram(diagram_id: UUID) -> DiagramRef:
    """Raise `DiagramNotFound` if the diagram does not exist."""
    diagram = Diagram.objects.filter(id=diagram_id).first()
    if diagram is None:
        raise DiagramNotFound
    return DiagramRef(
        id=diagram.id,
        workspace_id=diagram.workspace_id,
        name=diagram.name,
        change_number=diagram.change_number,
        updated_at=diagram.updated_at,
    )
