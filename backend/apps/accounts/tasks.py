"""Background jobs of `accounts` (DESIGN.md section 10.3)."""

from django.core.management import call_command

from apps.core.jobs import MAINTENANCE_QUEUE, app


@app.periodic(cron="30 3 * * *")
@app.task(queue=MAINTENANCE_QUEUE)
def clear_expired_sessions(timestamp: int) -> None:
    """Delete the expired sessions. The job is idempotent."""
    call_command("clearsessions")
