"""Root URL routes (DESIGN.md sections 11 and 16.3)."""

from django.conf import settings
from django.contrib import admin
from django.urls import URLPattern, URLResolver, include, path, re_path
from drf_spectacular.views import SpectacularAPIView

from apps.core import views as core_views
from config.spa import spa_index

api_patterns: list[URLPattern | URLResolver] = [
    path("csrf", core_views.csrf, name="csrf"),
    path("", include("apps.accounts.urls")),
    path("", include("apps.workspaces.urls")),
    path("", include("apps.diagrams.urls")),
]

if settings.API_SCHEMA_ENABLED:
    api_patterns.append(path("schema/", SpectacularAPIView.as_view(), name="schema"))

urlpatterns = [
    path("admin/", admin.site.urls),
    path("_allauth/", include("allauth.headless.urls")),
    path("api/v1/", include(api_patterns)),
    path("healthz", core_views.healthz, name="healthz"),
    path("readyz", core_views.readyz, name="readyz"),
    # Every other path belongs to the router of the single-page app.
    re_path(r"^(?!(?:api|_allauth|admin|static|healthz|readyz)(?:/|$))(?P<path>.*)$", spa_index, name="spa"),
]
