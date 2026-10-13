"""Cursor pagination (DESIGN.md section 11.4)."""

from typing import Any
from urllib.parse import parse_qs, urlparse

from rest_framework import pagination
from rest_framework.response import Response


class CursorPagination(pagination.CursorPagination):
    """The view sets `ordering`. The `next` value is the cursor only, not a URL."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data: Any) -> Response:
        next_url = self.get_next_link()
        cursor = None
        if next_url:
            cursor = parse_qs(urlparse(next_url).query)[self.cursor_query_param][0]
        return Response({"results": data, "next": cursor})
