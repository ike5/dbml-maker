"""Spec tests for the requirements WSP-*."""

import pytest

from apps.workspaces import api
from apps.workspaces.tests.helpers import make_user

pytestmark = pytest.mark.django_db


def test_wsp_001_each_user_has_exactly_one_personal_workspace():
    user = make_user()
    ids = {api.get_or_create_personal_workspace(user.id).id for _ in range(3)}
    assert len(ids) == 1
    assert set(api.list_roles_for_user(user.id)) == ids
