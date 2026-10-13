"""Domain errors of `accounts` (DESIGN.md section 5)."""

from apps.core.errors import NotFound


class UserNotFound(NotFound):
    code = "user_not_found"
    message = "The user does not exist."
