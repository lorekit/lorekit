"""MCP auth — plugin point for MCP endpoint authentication.

Open source default: No auth (MCP tools are public, same as the API).
Cloud override: TokenVerifier that validates Better Auth JWTs.

The cloud/ submodule calls set_mcp_auth() at startup to inject real auth.
The open source app runs MCP without any authentication requirement.

This follows the same plugin pattern as lorekit/auth/user.py.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Use Any to avoid importing fastmcp at module level (it's optional for open-source)
_mcp_auth_provider = None


def set_mcp_auth(provider: object) -> None:
    """Register an MCP auth provider (called by cloud/ at startup).

    The provider should be a fastmcp.server.auth.TokenVerifier subclass.
    """
    global _mcp_auth_provider
    _mcp_auth_provider = provider
    logger.info("MCP auth provider registered: %s", type(provider).__name__)


def get_mcp_auth():
    """Return the active MCP auth provider, or None for open-source mode."""
    return _mcp_auth_provider
