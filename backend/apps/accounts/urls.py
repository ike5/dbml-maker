"""URL routes of `accounts`."""

from django.urls import URLPattern, URLResolver, path

from apps.accounts import views

urlpatterns: list[URLPattern | URLResolver] = [
    path("accounts/me", views.AccountMeView.as_view(), name="account-me"),
]
