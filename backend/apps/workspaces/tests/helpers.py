"""User helper for the tests of `workspaces`.

The tests do not use `apps.accounts.testing`. That module imports the private modules of `accounts`, and the
import contracts forbid this for `workspaces`, also through an indirect chain.
"""

import itertools

from django.contrib.auth import get_user_model

_counter = itertools.count(1)


def make_user():
    return get_user_model().objects.create_user(f"ws-user{next(_counter)}@example.com", None)
