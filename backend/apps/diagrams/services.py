"""The business workflows of `diagrams` (DESIGN.md section 7).

Each function is one transaction. Each function that has a user calls `require_role` first (section 4.4).
"""

import secrets
from datetime import UTC, timedelta
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.template.loader import render_to_string
from django.utils import timezone

from apps.accounts import api as accounts_api
from apps.comms import api as comms_api
from apps.core.errors import DomainError, PayloadTooLarge, ValidationFailed
from apps.diagrams.errors import (
    DiagramConflict,
    DiagramNotFound,
    DiagramNotInTrash,
    PublicLinkOff,
    ShareExists,
    ShareLimit,
    ShareNotFound,
    ShareSelf,
    VersionNotFound,
)
from apps.diagrams.layout import default_layout, validate_layout
from apps.diagrams.models import Diagram, PublicLink, Share, Version
from apps.diagrams.policy import DiagramRole, Loaded, require_role
from apps.diagrams.selectors import get_public_diagram
from apps.workspaces import api as workspaces_api

SHARE_ROLES = {Share.Role.VIEWER.value, Share.Role.EDITOR.value}


# --- Input rules (DESIGN.md section 7.11) ---


def _clean_name(value: object, field: str = "name") -> str:
    if not isinstance(value, str):
        raise ValidationFailed(fields={field: ["Send text."]})
    cleaned = value.strip()
    if not cleaned:
        raise ValidationFailed(fields={field: ["Type a value. It must not be empty."]})
    if len(cleaned) > settings.DIAGRAM_NAME_MAX_CHARS:
        raise ValidationFailed(
            fields={field: [f"Use {settings.DIAGRAM_NAME_MAX_CHARS} characters or fewer."]},
        )
    return cleaned


def _check_source(value: object) -> str:
    """Return the source with no change (DGM-003). Do not strip it. Do not change its line ends."""
    if not isinstance(value, str):
        raise ValidationFailed(fields={"source": ["Send text."]})
    try:
        size = len(value.encode("utf-8"))
    except UnicodeEncodeError:
        raise ValidationFailed(fields={"source": ["The text is not correct UTF-8."]}) from None
    if size > settings.DIAGRAM_SOURCE_MAX_BYTES:
        raise PayloadTooLarge("The source is too large.", code="source_too_large")
    return value


# --- Create, save, and conflict control ---


def create_diagram(user_id: UUID, *, name: str, source: str = "", layout: object = None) -> Loaded:
    cleaned_name = _clean_name(name)
    cleaned_source = _check_source(source)
    cleaned_layout = default_layout() if layout is None else validate_layout(layout)
    with transaction.atomic():
        workspace = workspaces_api.get_or_create_personal_workspace(user_id)
        diagram = Diagram.objects.create(
            workspace_id=workspace.id,
            name=cleaned_name,
            source=cleaned_source,
            layout=cleaned_layout,
            created_by_id=user_id,
            updated_by_id=user_id,
        )
    return Loaded(diagram, DiagramRole.OWNER)


def _conflict(diagram_id: UUID) -> DomainError:
    """Make the 412 error with the current state (section 7.3)."""
    current = Diagram.objects.filter(id=diagram_id).first()
    if current is None or current.trashed_at is not None:
        # The diagram went to the trash or was deleted after `require_role`.
        return DiagramNotFound()
    updated_by = None
    if current.updated_by_id is not None:
        user = accounts_api.get_users([current.updated_by_id]).get(current.updated_by_id)
        if user is not None:
            updated_by = {"id": str(user.id), "email": user.email, "display_name": user.display_name}
    return DiagramConflict(
        extra={
            "current": {
                "change_number": current.change_number,
                "updated_by": updated_by,
                "updated_at": current.updated_at.astimezone(UTC).isoformat().replace("+00:00", "Z"),
            }
        }
    )


def _save(diagram_id: UUID, user_id: UUID, expected_change_number: int, changes: dict[str, Any]) -> Diagram:
    """One conditional UPDATE. If the change number is old, no row changes and the save fails (DGM-002)."""
    rows = Diagram.objects.filter(id=diagram_id, change_number=expected_change_number, trashed_at__isnull=True).update(
        **changes,
        change_number=F("change_number") + 1,
        updated_at=timezone.now(),
        updated_by_id=user_id,
    )
    if rows == 0:
        raise _conflict(diagram_id)
    return Diagram.objects.get(id=diagram_id)


def _apply_auto_version(diagram: Diagram, user_id: UUID) -> None:
    """VER-002: make an `auto` version if the newest version is old and the content is new."""
    newest = Version.objects.filter(diagram_id=diagram.id).order_by("-created_at", "-id").first()
    if newest is not None:
        if timezone.now() - newest.created_at <= timedelta(minutes=settings.DIAGRAM_AUTO_VERSION_MINUTES):
            return
        if newest.source == diagram.source and newest.layout == diagram.layout:
            return
    Version.objects.create(
        diagram_id=diagram.id,
        kind=Version.Kind.AUTO,
        source=diagram.source,
        layout=diagram.layout,
        change_number=diagram.change_number,
        created_by_id=user_id,
    )


def update_diagram(
    user_id: UUID,
    diagram_id: UUID,
    *,
    expected_change_number: int,
    name: str | None = None,
    source: str | None = None,
    layout: object = None,
) -> Loaded:
    with transaction.atomic():
        _, role = require_role(user_id, diagram_id, DiagramRole.EDITOR)
        changes: dict[str, Any] = {}
        if name is not None:
            changes["name"] = _clean_name(name)
        if source is not None:
            changes["source"] = _check_source(source)
        if layout is not None:
            changes["layout"] = validate_layout(layout)
        diagram = _save(diagram_id, user_id, expected_change_number, changes)
        _apply_auto_version(diagram, user_id)
    return Loaded(diagram, role)


# --- Trash and duplicate (sections 7.7 and 7.8) ---


def trash_diagram(user_id: UUID, diagram_id: UUID) -> None:
    with transaction.atomic():
        require_role(user_id, diagram_id, DiagramRole.OWNER)
        Diagram.objects.filter(id=diagram_id).update(trashed_at=timezone.now())


def restore_diagram(user_id: UUID, diagram_id: UUID) -> Loaded:
    with transaction.atomic():
        diagram, role = require_role(user_id, diagram_id, DiagramRole.OWNER, allow_trashed=True)
        if diagram.trashed_at is not None:
            Diagram.objects.filter(id=diagram_id).update(trashed_at=None)
            diagram.refresh_from_db()
    return Loaded(diagram, role)


def delete_diagram_permanently(user_id: UUID, diagram_id: UUID) -> None:
    with transaction.atomic():
        diagram, _ = require_role(user_id, diagram_id, DiagramRole.OWNER, allow_trashed=True)
        if diagram.trashed_at is None:
            raise DiagramNotInTrash
        diagram.delete()


def _copy_diagram(user_id: UUID, original: Diagram) -> Loaded:
    workspace = workspaces_api.get_or_create_personal_workspace(user_id)
    copy = Diagram.objects.create(
        workspace_id=workspace.id,
        name=f"Copy of {original.name}"[: settings.DIAGRAM_NAME_MAX_CHARS],
        source=original.source,
        layout=original.layout,
        created_by_id=user_id,
        updated_by_id=user_id,
    )
    return Loaded(copy, DiagramRole.OWNER)


def duplicate_diagram(user_id: UUID, diagram_id: UUID) -> Loaded:
    with transaction.atomic():
        original, _ = require_role(user_id, diagram_id, DiagramRole.VIEWER)
        return _copy_diagram(user_id, original)


# --- Versions (section 7.4) ---


def create_named_version(user_id: UUID, diagram_id: UUID, *, label: str) -> Version:
    """VER-001: copy the current content on the server."""
    cleaned_label = _clean_name(label, "label")
    with transaction.atomic():
        require_role(user_id, diagram_id, DiagramRole.EDITOR)
        # The lock stops a save between the read and the copy.
        diagram = Diagram.objects.select_for_update().get(id=diagram_id)
        return Version.objects.create(
            diagram_id=diagram.id,
            kind=Version.Kind.NAMED,
            label=cleaned_label,
            source=diagram.source,
            layout=diagram.layout,
            change_number=diagram.change_number,
            created_by_id=user_id,
        )


def restore_version(user_id: UUID, diagram_id: UUID, version_id: UUID, *, expected_change_number: int) -> Loaded:
    """VER-003: a normal save, then a `restore` version. It does not apply the automatic version rule."""
    with transaction.atomic():
        _, role = require_role(user_id, diagram_id, DiagramRole.EDITOR)
        version = Version.objects.filter(id=version_id, diagram_id=diagram_id).first()
        if version is None:
            raise VersionNotFound
        diagram = _save(
            diagram_id,
            user_id,
            expected_change_number,
            {"source": version.source, "layout": version.layout},
        )
        if version.kind == Version.Kind.AUTO or not version.label:
            origin = version.created_at.astimezone(UTC).strftime("%Y-%m-%d %H:%M UTC")
        else:
            origin = version.label
        Version.objects.create(
            diagram_id=diagram.id,
            kind=Version.Kind.RESTORE,
            label=f"Restored from {origin}"[:200],
            source=diagram.source,
            layout=diagram.layout,
            change_number=diagram.change_number,
            created_by_id=user_id,
        )
    return Loaded(diagram, role)


# --- Shares (section 7.5) ---


def _check_share_role(role: str) -> str:
    if role not in SHARE_ROLES:
        raise ValidationFailed(fields={"role": ["Use viewer or editor."]})
    return role


def _send_share_notice(sharer_id: UUID, diagram: Diagram, share: Share) -> None:
    sharer = accounts_api.get_user(sharer_id)
    context = {
        "sharer": sharer.display_name or sharer.email,
        "diagram_name": diagram.name,
        "role": share.role,
        "email": share.email,
        "url": f"{settings.PUBLIC_BASE_URL}/d/{diagram.id}",
        "signup_url": f"{settings.PUBLIC_BASE_URL}/signup",
    }
    subject = render_to_string("diagrams/email/share_notice_subject.txt", context).strip()
    body = render_to_string("diagrams/email/share_notice_message.txt", context)
    comms_api.send_email(to=share.email, subject=subject, body=body, key=f"share-notice:{share.id}")


def add_share(user_id: UUID, diagram_id: UUID, *, email: str, role: str) -> Share:
    cleaned_role = _check_share_role(role)
    with transaction.atomic():
        diagram, _ = require_role(user_id, diagram_id, DiagramRole.OWNER)
        address = email.strip().lower()
        if address == accounts_api.get_user(user_id).email.lower():
            raise ShareSelf
        existing = Share.objects.filter(diagram_id=diagram_id)
        if existing.filter(email=address).exists():
            raise ShareExists
        if existing.count() >= settings.DIAGRAM_MAX_SHARES:
            raise ShareLimit
        try:
            # The savepoint keeps the outer transaction usable after a race on the unique constraint.
            with transaction.atomic():
                share = Share.objects.create(
                    diagram_id=diagram_id, email=address, role=cleaned_role, created_by_id=user_id
                )
        except IntegrityError:
            raise ShareExists from None
        _send_share_notice(user_id, diagram, share)
    return share


def _get_share(diagram_id: UUID, share_id: UUID) -> Share:
    share = Share.objects.filter(id=share_id, diagram_id=diagram_id).first()
    if share is None:
        raise ShareNotFound
    return share


def change_share(user_id: UUID, diagram_id: UUID, share_id: UUID, *, role: str) -> Share:
    cleaned_role = _check_share_role(role)
    with transaction.atomic():
        require_role(user_id, diagram_id, DiagramRole.OWNER)
        share = _get_share(diagram_id, share_id)
        share.role = cleaned_role
        share.save(update_fields=["role"])
    return share


def remove_share(user_id: UUID, diagram_id: UUID, share_id: UUID) -> None:
    with transaction.atomic():
        require_role(user_id, diagram_id, DiagramRole.OWNER)
        _get_share(diagram_id, share_id).delete()


# --- Public link (section 7.6) ---


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def enable_public_link(user_id: UUID, diagram_id: UUID) -> PublicLink:
    with transaction.atomic():
        require_role(user_id, diagram_id, DiagramRole.OWNER)
        link = PublicLink.objects.filter(diagram_id=diagram_id).first()
        if link is not None:
            return link
        try:
            with transaction.atomic():
                return PublicLink.objects.create(diagram_id=diagram_id, token=_new_token(), created_by_id=user_id)
        except IntegrityError:
            # A second request made the link first.
            return PublicLink.objects.get(diagram_id=diagram_id)


def rotate_public_link(user_id: UUID, diagram_id: UUID) -> PublicLink:
    with transaction.atomic():
        require_role(user_id, diagram_id, DiagramRole.OWNER)
        link = PublicLink.objects.filter(diagram_id=diagram_id).first()
        if link is None:
            raise PublicLinkOff
        link.token = _new_token()
        link.save(update_fields=["token"])
    return link


def disable_public_link(user_id: UUID, diagram_id: UUID) -> None:
    with transaction.atomic():
        require_role(user_id, diagram_id, DiagramRole.OWNER)
        PublicLink.objects.filter(diagram_id=diagram_id).delete()


def duplicate_public_diagram(user_id: UUID, token: str) -> Loaded:
    with transaction.atomic():
        return _copy_diagram(user_id, get_public_diagram(token))
