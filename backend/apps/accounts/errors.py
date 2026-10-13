"""Domain errors of `accounts` (DESIGN.md section 5)."""

from apps.core.errors import DomainError, NotFound


class UserNotFound(NotFound):
    code = "user_not_found"
    message = "The user does not exist."


class ReauthenticationRequired(DomainError):
    code = "reauthentication_required"
    message = "Log in again to do this action."
    http_status = 401
