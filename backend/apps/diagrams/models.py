"""Models of `diagrams` (DESIGN.md sections 7.1, 7.4 to 7.6, and 14.2)."""

from typing import ClassVar

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel


def default_layout() -> dict[str, object]:
    return {"format": 1, "tables": {}}


class Diagram(BaseModel):
    # The string form keeps the import rules true (DESIGN.md section 3.4).
    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.CASCADE, related_name="+")
    name = models.CharField(max_length=200)
    # The source is the text that the client sent, byte for byte (DGM-003).
    source = models.TextField(default="", blank=True)
    layout = models.JSONField(default=default_layout)
    change_number = models.IntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # The save sets this value with a conditional UPDATE, so `auto_now` does not apply.
    updated_at = models.DateTimeField(default=timezone.now)
    trashed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes: ClassVar = [
            models.Index(fields=["workspace", "updated_at"], name="diagram_workspace_updated_idx"),
            models.Index(fields=["trashed_at"], name="diagram_trashed_idx"),
        ]

    def __str__(self) -> str:
        return self.name


class Version(BaseModel):
    class Kind(models.TextChoices):
        AUTO = "auto"
        NAMED = "named"
        RESTORE = "restore"

    diagram = models.ForeignKey(Diagram, on_delete=models.CASCADE, related_name="versions")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    label = models.CharField(max_length=200, default="", blank=True)
    source = models.TextField(default="", blank=True)
    layout = models.JSONField(default=default_layout)
    change_number = models.IntegerField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        indexes: ClassVar = [models.Index(fields=["diagram", "created_at"], name="version_diagram_created_idx")]

    def __str__(self) -> str:
        return f"{self.kind} version of {self.diagram_id}"


class Share(BaseModel):
    class Role(models.TextChoices):
        VIEWER = "viewer"
        EDITOR = "editor"

    diagram = models.ForeignKey(Diagram, on_delete=models.CASCADE, related_name="shares")
    # The address is always lowercase (DESIGN.md section 7.5).
    email = models.CharField(max_length=254)
    role = models.CharField(max_length=16, choices=Role.choices)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["diagram", "email"], name="share_diagram_email_unique")
        ]
        indexes: ClassVar = [models.Index(fields=["email"], name="share_email_idx")]

    def __str__(self) -> str:
        return f"{self.role} share of {self.diagram_id}"


class PublicLink(BaseModel):
    diagram = models.OneToOneField(Diagram, on_delete=models.CASCADE, related_name="public_link")
    token = models.CharField(max_length=64, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    def __str__(self) -> str:
        return f"Public link of {self.diagram_id}"
