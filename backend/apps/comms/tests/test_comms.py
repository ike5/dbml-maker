import logging
import smtplib
from datetime import timedelta
from types import SimpleNamespace
from typing import Any

import pytest
from django.core import mail
from django.utils import timezone

from apps.comms import api
from apps.comms.models import OutboundEmail
from apps.comms.tasks import MAX_ATTEMPTS, deliver_email, purge_old_emails
from apps.comms.testing import list_outbound_emails

pytestmark = pytest.mark.django_db


def make_context(attempts: int = 0) -> Any:
    """A small fake of `procrastinate.JobContext`. The job reads only `job.id` and `job.attempts`."""
    return SimpleNamespace(job=SimpleNamespace(id=42, attempts=attempts))


def make_email(key: str = "k1") -> OutboundEmail:
    return OutboundEmail.objects.create(key=key, to_address="a@example.com", subject="Subject", body="Body")


def run(email: OutboundEmail, attempts: int = 0) -> None:
    deliver_email(make_context(attempts), email_id=str(email.id))


def test_send_email_makes_one_row_and_one_job_after_commit(job_connector, django_capture_on_commit_callbacks) -> None:
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        api.send_email(to="User@Example.COM", subject="S", body="B", key="k1")
        assert job_connector.jobs == {}
    assert len(callbacks) == 1
    callbacks[0]()
    email = OutboundEmail.objects.get()
    assert email.to_address == "user@example.com"
    assert email.status == "queued"
    (job,) = job_connector.jobs.values()
    assert job["task_name"] == "apps.comms.tasks.deliver_email"
    assert job["args"] == {"email_id": str(email.id)}
    assert job["queue_name"] == "email"


def test_send_email_with_the_same_key_does_nothing(job_connector, django_capture_on_commit_callbacks) -> None:
    with django_capture_on_commit_callbacks(execute=True):
        api.send_email(to="a@example.com", subject="S", body="B", key="k1")
    with django_capture_on_commit_callbacks(execute=True):
        api.send_email(to="b@example.com", subject="S2", body="B2", key="k1")
    assert OutboundEmail.objects.count() == 1
    assert OutboundEmail.objects.get().to_address == "a@example.com"
    assert len(job_connector.jobs) == 1


def test_deliver_email_sends_once() -> None:
    email = make_email()
    run(email)
    email.refresh_from_db()
    assert email.status == "sent"
    assert email.sent_at is not None
    assert email.attempts == 1
    assert [m.to for m in mail.outbox] == [["a@example.com"]]
    run(email)
    assert len(mail.outbox) == 1


def test_deliver_email_ignores_a_missing_row() -> None:
    email = make_email()
    email_id = str(email.id)
    email.delete()
    deliver_email(make_context(), email_id=email_id)
    assert mail.outbox == []


def test_temporary_error_keeps_queued_and_raises(monkeypatch) -> None:
    def fail(*args: Any, **kwargs: Any) -> None:
        raise smtplib.SMTPServerDisconnected("down")

    monkeypatch.setattr("apps.comms.tasks.send_mail", fail)
    email = make_email()
    with pytest.raises(smtplib.SMTPServerDisconnected):
        run(email, attempts=0)
    email.refresh_from_db()
    assert email.status == "queued"
    assert email.attempts == 1
    assert email.last_error.startswith("SMTPServerDisconnected")


def test_last_attempt_sets_failed_and_logs_without_address(monkeypatch, caplog) -> None:
    def fail(*args: Any, **kwargs: Any) -> None:
        raise ConnectionRefusedError("a@example.com refused")

    monkeypatch.setattr("apps.comms.tasks.send_mail", fail)
    email = make_email()
    with caplog.at_level(logging.ERROR), pytest.raises(ConnectionRefusedError):
        run(email, attempts=MAX_ATTEMPTS - 1)
    email.refresh_from_db()
    assert email.status == "failed"
    errors = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert len(errors) == 1
    assert "a@example.com" not in errors[0].getMessage()
    assert "42" in errors[0].getMessage()
    assert str(email.id) in errors[0].getMessage()


def test_error_that_is_not_temporary_sets_failed(monkeypatch) -> None:
    def fail(*args: Any, **kwargs: Any) -> None:
        raise ValueError("bad")

    monkeypatch.setattr("apps.comms.tasks.send_mail", fail)
    email = make_email()
    with pytest.raises(ValueError, match="bad"):
        run(email, attempts=0)
    email.refresh_from_db()
    assert email.status == "failed"


def test_purge_old_emails_deletes_only_old_rows() -> None:
    old = make_email("old")
    make_email("new")
    OutboundEmail.objects.filter(id=old.id).update(created_at=timezone.now() - timedelta(days=8))
    purge_old_emails(timestamp=0)
    assert [e.key for e in list_outbound_emails()] == ["new"]


def test_list_outbound_emails_is_oldest_first_and_filters() -> None:
    OutboundEmail.objects.create(key="a", to_address="x@example.com", subject="1", body="b")
    OutboundEmail.objects.create(key="b", to_address="y@example.com", subject="2", body="b")
    assert [e.key for e in list_outbound_emails()] == ["a", "b"]
    (only,) = list_outbound_emails(to="Y@example.com")
    assert only.key == "b"
    assert only.status == "queued"
