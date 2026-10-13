"""The job queue boundary (DESIGN.md sections 3.6 and 10). This is the only module that imports `procrastinate`."""

from typing import Any

from django.db import transaction
from procrastinate import RetryStrategy
from procrastinate.contrib.django import app

__all__ = ["EMAIL_QUEUE", "MAINTENANCE_QUEUE", "RetryStrategy", "app", "defer_on_commit"]

EMAIL_QUEUE = "email"
MAINTENANCE_QUEUE = "maintenance"


def defer_on_commit(task: Any, **kwargs: Any) -> None:
    """Enqueue a job after the transaction commits, so that the job sees only committed data (section 10.2, rule 4).

    If no transaction is open, Django runs the call at once.
    """
    transaction.on_commit(lambda: task.defer(**kwargs))
