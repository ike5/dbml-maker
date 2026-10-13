"""Thin DRF views of `diagrams` (DESIGN.md sections 7.9 and 7.11).

A view reads the request, calls a service or a selector, and formats the answer. It does not examine roles.
"""

from typing import Any, cast
from uuid import UUID

from rest_framework.pagination import BasePagination
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.errors import PreconditionRequired, ValidationFailed
from apps.core.pagination import CursorPagination
from apps.diagrams import selectors, serializers, services
from apps.diagrams.errors import InvalidIfMatch
from apps.diagrams.policy import Loaded

MAX_CHANGE_NUMBER = 2_147_483_647  # The largest value of a 32-bit column.


def _user_id(request: Request) -> UUID:
    return cast(UUID, request.user.pk)


def _expected_change_number(request: Request) -> int:
    """Read `If-Match`: `"<n>"` or `<n>` (section 7.11)."""
    raw = request.headers.get("If-Match")
    if raw is None:
        raise PreconditionRequired
    value = raw.strip().removeprefix("W/").strip('"')
    if not (value.isascii() and value.isdigit()) or int(value) > MAX_CHANGE_NUMBER:
        raise InvalidIfMatch
    return int(value)


def _diagram_response(loaded: Loaded, status: int = 200) -> Response:
    diagram, role = loaded
    users = selectors.users_by_id([diagram.updated_by_id])
    return Response(
        serializers.diagram_full(diagram, role, users),
        status=status,
        headers={"ETag": f'"{diagram.change_number}"'},
    )


def _paginate(view: APIView, request: Request, queryset: Any, paginator: BasePagination) -> list[Any]:
    page: list[Any] | None = paginator.paginate_queryset(queryset, request, view=view)
    assert page is not None
    return list(page)


class DiagramPagination(CursorPagination):
    ordering = ("-updated_at", "-id")


class VersionPagination(CursorPagination):
    ordering = ("-created_at", "-id")


class PublicLinkThrottle(ScopedRateThrottle):
    """SEC-005: the key is the IP address, also for a logged-in user."""

    def get_cache_key(self, request: Request, view: APIView) -> str:
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


# --- Diagrams ---


class DiagramListCreateView(APIView):
    def get(self, request: Request) -> Response:
        scope = request.query_params.get("scope", "mine")
        if scope not in selectors.SCOPES:
            raise ValidationFailed(fields={"scope": ["Use mine, shared, or trash."]})
        user_id = _user_id(request)
        queryset, workspace_roles = selectors.list_diagrams(user_id, scope)
        paginator = DiagramPagination()
        page = _paginate(self, request, queryset, paginator)
        roles = selectors.roles_of(user_id, page, workspace_roles)
        users = selectors.users_by_id(d.updated_by_id for d in page)
        return paginator.get_paginated_response([serializers.diagram_summary(d, roles[d.id], users) for d in page])

    def post(self, request: Request) -> Response:
        data = serializers.DiagramCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        loaded = services.create_diagram(_user_id(request), **data.validated_data)
        return _diagram_response(loaded, status=201)


class DiagramDetailView(APIView):
    def get(self, request: Request, diagram_id: UUID) -> Response:
        return _diagram_response(selectors.get_diagram_for(_user_id(request), diagram_id))

    def patch(self, request: Request, diagram_id: UUID) -> Response:
        expected = _expected_change_number(request)
        data = serializers.DiagramUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        loaded = services.update_diagram(
            _user_id(request), diagram_id, expected_change_number=expected, **data.validated_data
        )
        return _diagram_response(loaded)

    def delete(self, request: Request, diagram_id: UUID) -> Response:
        services.trash_diagram(_user_id(request), diagram_id)
        return Response(status=204)


class DiagramRestoreView(APIView):
    def post(self, request: Request, diagram_id: UUID) -> Response:
        return _diagram_response(services.restore_diagram(_user_id(request), diagram_id))


class DiagramPermanentView(APIView):
    def delete(self, request: Request, diagram_id: UUID) -> Response:
        services.delete_diagram_permanently(_user_id(request), diagram_id)
        return Response(status=204)


class DiagramDuplicateView(APIView):
    def post(self, request: Request, diagram_id: UUID) -> Response:
        return _diagram_response(services.duplicate_diagram(_user_id(request), diagram_id), status=201)


# --- Versions ---


class VersionListCreateView(APIView):
    def get(self, request: Request, diagram_id: UUID) -> Response:
        queryset = selectors.list_versions(_user_id(request), diagram_id)
        paginator = VersionPagination()
        page = _paginate(self, request, queryset, paginator)
        users = selectors.users_by_id(v.created_by_id for v in page)
        return paginator.get_paginated_response([serializers.version_summary(v, users) for v in page])

    def post(self, request: Request, diagram_id: UUID) -> Response:
        data = serializers.VersionCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        version = services.create_named_version(_user_id(request), diagram_id, label=data.validated_data["label"])
        users = selectors.users_by_id([version.created_by_id])
        return Response(serializers.version_summary(version, users), status=201)


class VersionDetailView(APIView):
    def get(self, request: Request, diagram_id: UUID, version_id: UUID) -> Response:
        version = selectors.get_version(_user_id(request), diagram_id, version_id)
        users = selectors.users_by_id([version.created_by_id])
        return Response(serializers.version_full(version, users))


class VersionRestoreView(APIView):
    def post(self, request: Request, diagram_id: UUID, version_id: UUID) -> Response:
        expected = _expected_change_number(request)
        loaded = services.restore_version(_user_id(request), diagram_id, version_id, expected_change_number=expected)
        return _diagram_response(loaded)


# --- Shares ---


class ShareListCreateView(APIView):
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "shares"

    def get_throttles(self) -> list[Any]:
        # SEC-005: the limit protects the share notice, so only the POST counts.
        return super().get_throttles() if self.request.method == "POST" else []

    def get(self, request: Request, diagram_id: UUID) -> Response:
        shares = selectors.list_shares(_user_id(request), diagram_id)
        return Response({"results": [serializers.share_data(s) for s in shares], "next": None})

    def post(self, request: Request, diagram_id: UUID) -> Response:
        data = serializers.ShareCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        share = services.add_share(_user_id(request), diagram_id, **data.validated_data)
        return Response(serializers.share_data(share), status=201)


class ShareDetailView(APIView):
    def patch(self, request: Request, diagram_id: UUID, share_id: UUID) -> Response:
        data = serializers.ShareChangeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        share = services.change_share(_user_id(request), diagram_id, share_id, role=data.validated_data["role"])
        return Response(serializers.share_data(share))

    def delete(self, request: Request, diagram_id: UUID, share_id: UUID) -> Response:
        services.remove_share(_user_id(request), diagram_id, share_id)
        return Response(status=204)


# --- Public link ---


class PublicLinkView(APIView):
    def get(self, request: Request, diagram_id: UUID) -> Response:
        return Response(serializers.public_link_data(selectors.get_public_link(_user_id(request), diagram_id)))

    def put(self, request: Request, diagram_id: UUID) -> Response:
        return Response(serializers.public_link_data(services.enable_public_link(_user_id(request), diagram_id)))

    def delete(self, request: Request, diagram_id: UUID) -> Response:
        services.disable_public_link(_user_id(request), diagram_id)
        return Response(status=204)


class PublicLinkRotateView(APIView):
    def post(self, request: Request, diagram_id: UUID) -> Response:
        return Response(serializers.public_link_data(services.rotate_public_link(_user_id(request), diagram_id)))


class PublicDiagramView(APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (PublicLinkThrottle,)
    throttle_scope = "public_link"

    def get(self, request: Request, token: str) -> Response:
        return Response(serializers.public_diagram_data(selectors.get_public_diagram(token)))


class PublicDuplicateView(APIView):
    def post(self, request: Request, token: str) -> Response:
        return _diagram_response(services.duplicate_public_diagram(_user_id(request), token), status=201)
