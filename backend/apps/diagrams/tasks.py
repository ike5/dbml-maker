"""The background jobs of `diagrams` (DESIGN.md sections 7.4, 7.7, and 10.3)."""

from datetime import timedelta

from django.conf import settings
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from apps.core.jobs import MAINTENANCE_QUEUE, app
from apps.diagrams.models import Diagram, Version


@app.periodic(cron="10 3 * * *")
@app.task(queue=MAINTENANCE_QUEUE)
def purge_trash(timestamp: int) -> None:
    """Delete the diagrams that are in the trash for more than `DIAGRAM_TRASH_DAYS` (DGM-004)."""
    limit = timezone.now() - timedelta(days=settings.DIAGRAM_TRASH_DAYS)
    Diagram.objects.filter(trashed_at__lt=limit).delete()


@app.periodic(cron="20 3 * * *")
@app.task(queue=MAINTENANCE_QUEUE)
def purge_old_auto_versions(timestamp: int) -> None:
    """Delete old `auto` versions. Keep the newest version of each diagram (VER-004)."""
    limit = timezone.now() - timedelta(days=settings.DIAGRAM_AUTO_VERSION_DAYS)
    newer = Version.objects.filter(diagram_id=OuterRef("diagram_id")).filter(
        Q(created_at__gt=OuterRef("created_at")) | Q(created_at=OuterRef("created_at"), id__gt=OuterRef("id"))
    )
    Version.objects.filter(kind=Version.Kind.AUTO, created_at__lt=limit).filter(Exists(newer)).delete()
