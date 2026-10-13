"""Domain errors of `diagrams` (DESIGN.md section 7.11)."""

from apps.core.errors import Conflict, Forbidden, NotFound, PreconditionFailed, ValidationFailed


class DiagramNotFound(NotFound):
    code = "diagram_not_found"
    message = "The diagram does not exist."


class DiagramForbidden(Forbidden):
    code = "diagram_forbidden"
    message = "Your role does not let you do this action on the diagram."


class VersionNotFound(NotFound):
    code = "version_not_found"
    message = "The version does not exist."


class ShareNotFound(NotFound):
    code = "share_not_found"
    message = "The share does not exist."


class PublicLinkNotFound(NotFound):
    code = "public_link_not_found"
    message = "The public link does not exist."


class DiagramConflict(PreconditionFailed):
    code = "diagram_conflict"
    message = "Another person changed this diagram. Load the new version, or keep your version."


class DiagramNotInTrash(Conflict):
    code = "diagram_not_in_trash"
    message = "The diagram is not in the trash. Move it to the trash first."


class ShareSelf(ValidationFailed):
    code = "share_self"
    message = "You cannot share a diagram with your own address."


class ShareExists(Conflict):
    code = "share_exists"
    message = "The diagram has a share for this address."


class ShareLimit(Conflict):
    code = "share_limit"
    message = "The diagram has the maximum number of shares."


class PublicLinkOff(Conflict):
    code = "public_link_off"
    message = "The public link is off. Turn it on first."


class InvalidIfMatch(ValidationFailed):
    code = "invalid_if_match"
    message = "The If-Match header must be a change number."
