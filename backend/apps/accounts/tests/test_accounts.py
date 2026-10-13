import uuid

import pytest
from allauth.account.models import EmailAddress
from django.db import IntegrityError, transaction
from django.test import Client
from rest_framework.test import APIClient

from apps.accounts import api
from apps.accounts.adapter import AccountAdapter
from apps.accounts.models import User
from apps.accounts.testing import force_login, make_user

pytestmark = pytest.mark.django_db


def test_manager_lowercases_the_email_address() -> None:
    user = User.objects.create_user("  Ada@Example.COM ", "a-long-password-1")
    assert user.email == "ada@example.com"
    assert user.check_password("a-long-password-1")
    assert not user.is_staff


def test_manager_rejects_an_empty_email_address() -> None:
    with pytest.raises(ValueError, match="email"):
        User.objects.create_user("", "a-long-password-1")


def test_manager_makes_a_superuser() -> None:
    user = User.objects.create_superuser("root@example.com", "a-long-password-1")
    assert user.is_staff
    assert user.is_superuser


def test_primary_key_is_a_uuid_version_7() -> None:
    user = User.objects.create_user("v7@example.com")
    assert user.id.version == 7


def test_email_is_unique_without_regard_to_case() -> None:
    User.objects.create_user("same@example.com")
    with pytest.raises(IntegrityError), transaction.atomic():
        User(email="SAME@example.com").save()


def test_api_get_user_returns_a_frozen_reference() -> None:
    created = make_user(display_name="Ada")
    ref = api.get_user(created.id)
    assert ref == created
    assert ref.display_name == "Ada"
    with pytest.raises(AttributeError):
        ref.email = "x@example.com"  # type: ignore[misc]


def test_api_get_user_raises_for_an_unknown_id() -> None:
    with pytest.raises(api.UserNotFound) as info:
        api.get_user(uuid.uuid4())
    assert info.value.code == "user_not_found"
    assert info.value.http_status == 404


def test_api_get_users_skips_unknown_ids() -> None:
    first = make_user()
    second = make_user()
    result = api.get_users([first.id, second.id, uuid.uuid4()])
    assert set(result) == {first.id, second.id}
    assert result[first.id].email == first.email


def test_make_user_makes_a_verified_email_address() -> None:
    ref = make_user()
    row = EmailAddress.objects.get(user_id=ref.id)
    assert row.verified
    assert row.primary
    assert ref.email.endswith("@example.com")


def test_make_user_can_skip_verification() -> None:
    ref = make_user(verified=False)
    assert not EmailAddress.objects.filter(user_id=ref.id).exists()


def test_make_user_makes_unique_addresses() -> None:
    assert make_user().email != make_user().email


def test_make_user_sets_the_password_and_the_staff_flag() -> None:
    ref = make_user(email="Staff@Example.com", password="a-long-password-1", is_staff=True)
    user = User.objects.get(id=ref.id)
    assert ref.email == "staff@example.com"
    assert user.check_password("a-long-password-1")
    assert user.is_staff


@pytest.mark.parametrize("client_class", [Client, APIClient])
def test_force_login_starts_a_session(client_class: type) -> None:
    ref = make_user()
    client = client_class()
    force_login(client, ref.id)
    assert client.session["_auth_user_id"] == str(ref.id)


def test_adapter_follows_the_signup_setting(settings) -> None:
    adapter = AccountAdapter()
    settings.SIGNUP_ENABLED = False
    assert adapter.is_open_for_signup(None) is False  # type: ignore[arg-type]
    settings.SIGNUP_ENABLED = True
    assert adapter.is_open_for_signup(None) is True  # type: ignore[arg-type]


def test_str_of_a_user_is_the_email_address() -> None:
    assert str(User(email="a@example.com")) == "a@example.com"
