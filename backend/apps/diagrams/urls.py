"""URL routes of `diagrams` (DESIGN.md section 7.9). `config/urls.py` mounts them below `/api/v1/`."""

from django.urls import URLPattern, URLResolver, path

from apps.diagrams import views

urlpatterns: list[URLPattern | URLResolver] = [
    path("diagrams", views.DiagramListCreateView.as_view(), name="diagram-list"),
    path("diagrams/<uuid:diagram_id>", views.DiagramDetailView.as_view(), name="diagram-detail"),
    path("diagrams/<uuid:diagram_id>/restore", views.DiagramRestoreView.as_view(), name="diagram-restore"),
    path("diagrams/<uuid:diagram_id>/permanent", views.DiagramPermanentView.as_view(), name="diagram-permanent"),
    path("diagrams/<uuid:diagram_id>/duplicate", views.DiagramDuplicateView.as_view(), name="diagram-duplicate"),
    path("diagrams/<uuid:diagram_id>/versions", views.VersionListCreateView.as_view(), name="version-list"),
    path(
        "diagrams/<uuid:diagram_id>/versions/<uuid:version_id>",
        views.VersionDetailView.as_view(),
        name="version-detail",
    ),
    path(
        "diagrams/<uuid:diagram_id>/versions/<uuid:version_id>/restore",
        views.VersionRestoreView.as_view(),
        name="version-restore",
    ),
    path("diagrams/<uuid:diagram_id>/shares", views.ShareListCreateView.as_view(), name="share-list"),
    path("diagrams/<uuid:diagram_id>/shares/<uuid:share_id>", views.ShareDetailView.as_view(), name="share-detail"),
    path("diagrams/<uuid:diagram_id>/public-link", views.PublicLinkView.as_view(), name="public-link"),
    path(
        "diagrams/<uuid:diagram_id>/public-link/rotate",
        views.PublicLinkRotateView.as_view(),
        name="public-link-rotate",
    ),
    path("public/<str:token>", views.PublicDiagramView.as_view(), name="public-diagram"),
    path("public/<str:token>/duplicate", views.PublicDuplicateView.as_view(), name="public-duplicate"),
]
