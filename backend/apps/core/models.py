"""Abstract base model for all apps (DESIGN.md section 9)."""

import uuid

from django.db import models


class BaseModel(models.Model):
    """A UUIDv7 key makes new rows go to the end of the index (DESIGN.md section 14.1)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
