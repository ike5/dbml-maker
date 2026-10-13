"""Tests of the `workspaces` app."""

import uuid
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from apps.accounts.testing import make_user
from apps.workspaces import api, services
from apps.workspaces.models import Member, Workspace
from apps.workspaces.testing import add_member, make_team_workspace

pytestmark = pytest.mark.django_db


def test_first_call_makes_workspace_and_owner_member():
    user = make_user()
    ref = api.get_or_create_personal_workspace(user.id)
    assert (ref.name, ref.kind) == ("Personal", "personal")
    assert Workspace.objects.count() == 1
    member = Member.objects.get()
    assert (member.user_id, member.workspace_id, member.role) == (user.id, ref.id, "owner")


def test_second_call_returns_same_workspace_without_new_rows():
    user = make_user()
    first = api.get_or_create_personal_workspace(user.id)
    second = api.get_or_create_personal_workspace(user.id)
    assert first == second
    assert Workspace.objects.count() == 1
    assert Member.objects.count() == 1


def test_integrity_error_path_returns_existing_workspace():
    user = make_user()
    existing = Workspace.objects.create(name="Personal", kind="personal", personal_owner_id=user.id)
    # The first read finds nothing, as if the other request had not yet written.
    with mock.patch.object(services, "_find_personal_workspace", return_value=None):
        result = services.get_or_create_personal_workspace(user.id)
    assert result.id == existing.id
    assert Workspace.objects.count() == 1
    assert Member.objects.count() == 0


def test_get_role():
    user = make_user()
    other = make_user()
    team = make_team_workspace()
    add_member(workspace_id=team.id, user_id=user.id, role=api.WorkspaceRole.EDITOR)
    assert api.get_role(user.id, team.id) is api.WorkspaceRole.EDITOR
    assert api.get_role(other.id, team.id) is None
    assert api.get_role(user.id, uuid.uuid4()) is None


def test_list_roles_for_user_includes_personal_and_team():
    user = make_user()
    team = make_team_workspace()
    add_member(workspace_id=team.id, user_id=user.id, role=api.WorkspaceRole.VIEWER)
    roles = api.list_roles_for_user(user.id)
    personal = api.get_or_create_personal_workspace(user.id)
    assert roles == {personal.id: api.WorkspaceRole.OWNER, team.id: api.WorkspaceRole.VIEWER}


def test_list_roles_makes_personal_workspace():
    user = make_user()
    assert Workspace.objects.count() == 0
    assert len(api.list_roles_for_user(user.id)) == 1
    assert Workspace.objects.filter(kind="personal").count() == 1


def test_check_constraint_refuses_bad_rows():
    user = make_user()
    with pytest.raises(IntegrityError), transaction.atomic():
        Workspace.objects.create(name="Bad", kind="personal")
    with pytest.raises(IntegrityError), transaction.atomic():
        Workspace.objects.create(name="Bad", kind="team", personal_owner_id=user.id)


def test_unique_constraints():
    user = make_user()
    api.get_or_create_personal_workspace(user.id)
    with pytest.raises(IntegrityError), transaction.atomic():
        Workspace.objects.create(name="Second", kind="personal", personal_owner_id=user.id)
    team = make_team_workspace()
    add_member(workspace_id=team.id, user_id=user.id, role=api.WorkspaceRole.VIEWER)
    with pytest.raises(IntegrityError), transaction.atomic():
        add_member(workspace_id=team.id, user_id=user.id, role=api.WorkspaceRole.ADMIN)


def test_user_delete_cascades():
    user = make_user()
    api.get_or_create_personal_workspace(user.id)
    get_user_model().objects.get(id=user.id).delete()
    assert Workspace.objects.count() == 0
    assert Member.objects.count() == 0


def test_str_of_models():
    user = make_user()
    ref = api.get_or_create_personal_workspace(user.id)
    assert str(Workspace.objects.get(id=ref.id)) == "Personal"
    assert str(user.id) in str(Member.objects.get())
