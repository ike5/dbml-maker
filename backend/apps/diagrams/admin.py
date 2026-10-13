"""Django admin for `diagrams` (DESIGN.md section 4.9)."""

from django.contrib import admin

from apps.diagrams.models import Diagram, PublicLink, Share, Version


@admin.register(Diagram)
class DiagramAdmin(admin.ModelAdmin):
    list_display = ("name", "workspace", "change_number", "updated_at", "trashed_at")
    search_fields = ("name",)
    list_filter = ("trashed_at",)
    raw_id_fields = ("workspace", "created_by", "updated_by")


@admin.register(Version)
class VersionAdmin(admin.ModelAdmin):
    list_display = ("diagram", "kind", "label", "change_number", "created_at")
    list_filter = ("kind",)
    raw_id_fields = ("diagram", "created_by")


@admin.register(Share)
class ShareAdmin(admin.ModelAdmin):
    list_display = ("diagram", "email", "role", "created_at")
    raw_id_fields = ("diagram", "created_by")


@admin.register(PublicLink)
class PublicLinkAdmin(admin.ModelAdmin):
    list_display = ("diagram", "created_at")
    # The token is a secret. The admin does not show it.
    exclude = ("token",)
    raw_id_fields = ("diagram", "created_by")
