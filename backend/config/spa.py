"""The view that serves the index file of the single-page app (DESIGN.md section 16.3)."""

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpRequest, HttpResponse, HttpResponseBase


def spa_index(request: HttpRequest, path: str = "") -> HttpResponseBase:
    """Return `index.html`. The browser must always load the newest copy, so the cache is off."""
    index_path = Path(settings.SPA_INDEX_PATH)
    if not index_path.is_file():
        return HttpResponse(
            "The index file of the app is not built. Run the frontend build.",
            status=404,
            content_type="text/plain; charset=utf-8",
        )
    response = FileResponse(index_path.open("rb"), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    return response
