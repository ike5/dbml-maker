import logging
from types import SimpleNamespace
from typing import Any

import pytest

from apps.comms.models import OutboundEmail
from apps.comms.tasks import deliver_email


@pytest.mark.django_db
def test_ops_002_failed_email_job_keeps_failed_status_and_logs_error(monkeypatch, caplog) -> None:
    def fail(*args: Any, **kwargs: Any) -> None:
        raise ValueError("not temporary")

    monkeypatch.setattr("apps.comms.tasks.send_mail", fail)
    email = OutboundEmail.objects.create(key="k", to_address="a@example.com", subject="S", body="B")
    context = SimpleNamespace(job=SimpleNamespace(id=7, attempts=0))
    with caplog.at_level(logging.ERROR), pytest.raises(ValueError, match="not temporary"):
        deliver_email(context, email_id=str(email.id))  # type: ignore[arg-type]
    email.refresh_from_db()
    assert email.status == "failed"
    assert any(r.levelno == logging.ERROR and "7" in r.getMessage() for r in caplog.records)
