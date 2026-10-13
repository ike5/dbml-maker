"""The public interface of `comms` (DESIGN.md section 8.5)."""

from apps.comms import services


def send_email(*, to: str, subject: str, body: str, key: str) -> None:
    """Send an email after the open transaction commits. The same `key` sends the email only one time."""
    services.send_email(to=to, subject=subject, body=body, key=key)
