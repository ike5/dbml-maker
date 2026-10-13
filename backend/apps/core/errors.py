"""Domain errors. The API handler changes them into the error envelope (DESIGN.md sections 3.7 and 11.3)."""

from typing import Any


class DomainError(Exception):
    """Base class of all domain errors. A subclass sets the default values of the three class attributes."""

    code: str = "server_error"
    message: str = "An error occurred."
    http_status: int = 400

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        http_status: int | None = None,
        fields: dict[str, list[str]] | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        if message is not None:
            self.message = message
        if code is not None:
            self.code = code
        if http_status is not None:
            self.http_status = http_status
        self.fields = fields
        self.extra = extra
        super().__init__(self.message)


class NotFound(DomainError):
    code = "not_found"
    message = "The object does not exist."
    http_status = 404


class Forbidden(DomainError):
    code = "permission_denied"
    message = "You do not have permission to do this action."
    http_status = 403


class Conflict(DomainError):
    code = "conflict"
    message = "The state of the object does not let this action occur."
    http_status = 409


class ValidationFailed(DomainError):
    code = "validation_failed"
    message = "The input is not correct."
    http_status = 400


class PreconditionFailed(DomainError):
    code = "precondition_failed"
    message = "The object changed after you read it. Load the new data and try again."
    http_status = 412


class PreconditionRequired(DomainError):
    code = "precondition_required"
    message = "The request must have the If-Match header."
    http_status = 428


class PayloadTooLarge(DomainError):
    code = "payload_too_large"
    message = "The request body is too large."
    http_status = 413
