"""A read-only admin for the outbound emails."""

from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from apps.comms.models import OutboundEmail


@admin.register(OutboundEmail)
class OutboundEmailAdmin(admin.ModelAdmin):
    list_display = ("to_address", "subject", "status", "attempts", "created_at", "sent_at")
    list_filter = ("status",)
    search_fields = ("to_address",)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False
