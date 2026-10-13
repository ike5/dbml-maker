"""The background jobs of `comms` (DESIGN.md sections 8.1 and 10)."""

import logging
import smtplib
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from procrastinate import JobContext

from apps.comms.models import OutboundEmail
from apps.core.jobs import EMAIL_QUEUE, MAINTENANCE_QUEUE, RetryStrategy, app

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
PURGE_AFTER = timedelta(days=7)
# Only temporary errors get a retry (DESIGN.md section 10.2, rule 5).
TEMPORARY_ERRORS = (smtplib.SMTPException, OSError)


@app.task(
    queue=EMAIL_QUEUE,
    pass_context=True,
    # Procrastinate counts the retries, not the runs. The first run is not a retry.
    retry=RetryStrategy(max_attempts=MAX_ATTEMPTS - 1, exponential_wait=3, retry_exceptions=TEMPORARY_ERRORS),
)
def deliver_email(context: JobContext, email_id: str) -> None:
    """Send one email. The job is idempotent: it stops if the email has the status `sent`."""
    email = OutboundEmail.objects.filter(id=email_id).first()
    # An account delete or the purge job can remove the row before the job runs.
    if email is None or email.status == OutboundEmail.Status.SENT:
        return

    email.attempts += 1
    try:
        send_mail(email.subject, email.body, settings.DEFAULT_FROM_EMAIL, [email.to_address])
    except Exception as error:
        email.last_error = f"{type(error).__name__}: {error}"
        is_last_attempt = context.job.attempts + 1 >= MAX_ATTEMPTS
        if not isinstance(error, TEMPORARY_ERRORS) or is_last_attempt:
            email.status = OutboundEmail.Status.FAILED
            # No address, subject, or body in the log (SEC-006).
            logger.error("Email delivery failed (job %s, email %s)", context.job.id, email.id)
        email.save(update_fields=["attempts", "last_error", "status"])
        # Fail loudly (DESIGN.md section 10.2, rule 2).
        raise

    email.status = OutboundEmail.Status.SENT
    email.sent_at = timezone.now()
    email.save(update_fields=["attempts", "status", "sent_at"])


@app.periodic(cron="0 3 * * *")
@app.task(queue=MAINTENANCE_QUEUE)
def purge_old_emails(timestamp: int) -> None:
    """Delete the emails that are older than 7 days, because a body can contain a reset URL."""
    OutboundEmail.objects.filter(created_at__lt=timezone.now() - PURGE_AFTER).delete()
