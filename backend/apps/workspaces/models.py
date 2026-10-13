"""Models of `workspaces` (DESIGN.md section 6.1)."""

from typing import ClassVar

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel


class Workspace(BaseModel):
    class Kind(models.TextChoices):
        PERSONAL = "personal"
        TEAM = "team"

    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    # The unique one-to-one link stops a second personal workspace under concurrent requests (WSP-001).
    personal_owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        constraints: ClassVar = [
            models.CheckConstraint(
                condition=(
                    models.Q(kind="personal", personal_owner__isnull=False)
                    | models.Q(kind="team", personal_owner__isnull=True)
                ),
                name="workspace_personal_owner_iff_personal",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Member(BaseModel):
    class Role(models.TextChoices):
        OWNER = "owner"
        ADMIN = "admin"
        EDITOR = "editor"
        VIEWER = "viewer"

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    role = models.CharField(max_length=16, choices=Role.choices)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["workspace", "user"], name="member_workspace_user_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} is {self.role} of {self.workspace_id}"
