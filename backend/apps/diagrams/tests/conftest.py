"""Fixtures for the tests of `diagrams`."""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache() -> None:
    """The throttles keep their counters in the cache (SEC-005). Each test starts with a clean cache."""
    cache.clear()
