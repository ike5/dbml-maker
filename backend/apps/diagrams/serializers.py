"""Serializers of `diagrams` (DESIGN.md section 7.11).

The input serializers check only the shape. The services apply the size limits and the other rules.
The output functions make the plain dicts of section 7.11.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from django.conf import settings
from rest_framework import serializers

from apps.accounts.api import UserRef
from apps.diagrams.models import Diagram, PublicLink, Share, Version
from apps.diagrams.policy import DiagramRole

# --- Input ---


class DiagramCreateSerializer(serializers.Serializer[Any]):
    # `trim_whitespace=False`: the service strips the name, and it must keep the source exactly (DGM-003).
    name = serializers.CharField(trim_whitespace=False, allow_blank=True)
    source = serializers.CharField(  # type: ignore[assignment]
        trim_whitespace=False, allow_blank=True, required=False, default=""
    )
    layout = serializers.JSONField(required=False, default=None)


class DiagramUpdateSerializer(serializers.Serializer[Any]):
    name = serializers.CharField(trim_whitespace=False, allow_blank=True, required=False)
    source = serializers.CharField(trim_whitespace=False, allow_blank=True, required=False)  # type: ignore[assignment]
    layout = serializers.JSONField(required=False)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if not attrs:
            raise serializers.ValidationError("Send at least one of name, source, and layout.")
        return attrs


class VersionCreateSerializer(serializers.Serializer[Any]):
    label = serializers.CharField(trim_whitespace=False, allow_blank=True)  # type: ignore[assignment]


class ShareCreateSerializer(serializers.Serializer[Any]):
    email = serializers.EmailField(max_length=254)
    role = serializers.ChoiceField(choices=[Share.Role.VIEWER.value, Share.Role.EDITOR.value])


class ShareChangeSerializer(serializers.Serializer[Any]):
    role = serializers.ChoiceField(choices=[Share.Role.VIEWER.value, Share.Role.EDITOR.value])


# --- Output ---


def iso(value: datetime) -> str:
    """Times are ISO 8601 in UTC, with `Z` (section 11.1)."""
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def user_summary(user: UserRef | None) -> dict[str, Any] | None:
    if user is None:
        return None
    return {"id": str(user.id), "email": user.email, "display_name": user.display_name}


def diagram_summary(diagram: Diagram, role: DiagramRole | None, users: dict[UUID, UserRef]) -> dict[str, Any]:
    return {
        "id": str(diagram.id),
        "name": diagram.name,
        "role": role.value if role else None,
        "change_number": diagram.change_number,
        "updated_at": iso(diagram.updated_at),
        "updated_by": user_summary(users.get(diagram.updated_by_id)) if diagram.updated_by_id else None,
        "trashed_at": iso(diagram.trashed_at) if diagram.trashed_at else None,
    }


def diagram_full(diagram: Diagram, role: DiagramRole | None, users: dict[UUID, UserRef]) -> dict[str, Any]:
    return {
        **diagram_summary(diagram, role, users),
        "workspace_id": str(diagram.workspace_id),
        "source": diagram.source,
        "layout": diagram.layout,
        "created_at": iso(diagram.created_at),
    }


def version_summary(version: Version, users: dict[UUID, UserRef]) -> dict[str, Any]:
    return {
        "id": str(version.id),
        "kind": version.kind,
        "label": version.label,
        "change_number": version.change_number,
        "created_at": iso(version.created_at),
        "created_by": user_summary(users.get(version.created_by_id)) if version.created_by_id else None,
    }


def version_full(version: Version, users: dict[UUID, UserRef]) -> dict[str, Any]:
    return {**version_summary(version, users), "source": version.source, "layout": version.layout}


def share_data(share: Share) -> dict[str, Any]:
    return {"id": str(share.id), "email": share.email, "role": share.role, "created_at": iso(share.created_at)}


def public_link_data(link: PublicLink | None) -> dict[str, Any]:
    if link is None:
        return {"enabled": False, "token": None, "url": None, "created_at": None}
    return {
        "enabled": True,
        "token": link.token,
        "url": f"{settings.PUBLIC_BASE_URL}/s/{link.token}",
        "created_at": iso(link.created_at),
    }


def public_diagram_data(diagram: Diagram) -> dict[str, Any]:
    return {
        "name": diagram.name,
        "source": diagram.source,
        "layout": diagram.layout,
        "updated_at": iso(diagram.updated_at),
    }
