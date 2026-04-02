"""User identity — plugin point for auth.

Open source default: LocalUser (no auth, single implicit user).
Cloud override: AuthenticatedUser parsed from Better Auth JWT.

The cloud/ submodule replaces `_user_provider` at startup to inject
real auth. The open source app never calls Better Auth.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Awaitable

from fastapi import Request


@dataclass
class CurrentUser:
    """Base user identity available to all request handlers."""
    id: str
    org_id: str
    email: str | None = None
    name: str | None = None
    role: str = "owner"  # owner | admin | member


# Default local user — no auth, full access
LocalUser = CurrentUser(
    id="local",
    org_id="local",
    email=None,
    name="Local User",
    role="owner",
)

# Provider function — cloud/ overrides this at startup
_user_provider: Callable[[Request], Awaitable[CurrentUser]] | None = None


def set_user_provider(provider: Callable[[Request], Awaitable[CurrentUser]]) -> None:
    """Register a custom user provider (called by cloud/ at startup)."""
    global _user_provider
    _user_provider = provider


async def get_current_user(request: Request) -> CurrentUser:
    """Get the current user from the request.

    Open source: always returns LocalUser (no auth check).
    Cloud: verifies JWT and returns authenticated user.
    """
    if _user_provider is not None:
        return await _user_provider(request)
    return LocalUser
