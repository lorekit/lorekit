"""Auth plugin system — open source defaults with cloud overrides.

Open source: no auth, LocalUser returned for all requests.
Cloud (cloud/ submodule): Better Auth JWT verification, org scoping.
"""

from lorekit.auth.user import get_current_user, CurrentUser, LocalUser

__all__ = ["get_current_user", "CurrentUser", "LocalUser"]
