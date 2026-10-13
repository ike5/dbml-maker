from typing import ClassVar

from django.contrib import admin

from apps.workspaces.models import Member, Workspace


class MemberInline(admin.TabularInline):
    model = Member
    extra = 0


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "personal_owner", "created_at")
    inlines: ClassVar = [MemberInline]
