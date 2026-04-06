"""Credit billing for LoreKit — plugin point for metering.

Open source default: UnlimitedCredits (no limits, no tracking).
Cloud override: CloudCreditProvider with real balance checks + Stripe.

The cloud/ submodule replaces `_provider` at startup to inject
real billing. The open source app never imports stripe.
"""

from __future__ import annotations

import threading
from typing import Protocol


class InsufficientCreditsError(Exception):
    """Raised when an org doesn't have enough credits for an action."""

    def __init__(self, org_id: str, required: int, available: int = 0):
        self.org_id = org_id
        self.required = required
        self.available = available
        super().__init__(
            f"Insufficient credits for org {org_id}: "
            f"need {required}, have {available}"
        )


class CreditProvider(Protocol):
    """Interface for credit balance management."""

    async def check(self, org_id: str, amount: int) -> bool: ...

    async def deduct(
        self,
        org_id: str,
        amount: int,
        source: str,
        ref_id: str | None = None,
        desc: str | None = None,
        metadata: dict | None = None,
    ) -> int: ...

    async def get_balance(self, org_id: str) -> int: ...

    async def refund(
        self,
        org_id: str,
        amount: int,
        source: str,
        ref_id: str | None = None,
        desc: str | None = None,
    ) -> int: ...


class UnlimitedCredits:
    """Default provider for open source mode — no limits."""

    async def check(self, org_id: str, amount: int) -> bool:
        return True

    async def deduct(
        self,
        org_id: str,
        amount: int,
        source: str,
        ref_id: str | None = None,
        desc: str | None = None,
        metadata: dict | None = None,
    ) -> int:
        return -1  # unlimited sentinel

    async def get_balance(self, org_id: str) -> int:
        return -1  # unlimited sentinel

    async def refund(
        self,
        org_id: str,
        amount: int,
        source: str,
        ref_id: str | None = None,
        desc: str | None = None,
    ) -> int:
        return -1  # unlimited sentinel


# Module-level provider — cloud/ overrides at startup
_provider: CreditProvider = UnlimitedCredits()  # type: ignore[assignment]
_lock = threading.Lock()


def set_credit_provider(provider: CreditProvider) -> None:
    """Register a custom credit provider (called by cloud/ at startup)."""
    global _provider
    with _lock:
        _provider = provider  # type: ignore[assignment]


async def check_credits(org_id: str, amount: int) -> bool:
    """Check if org has enough credits. Returns True in OS mode."""
    return await _provider.check(org_id, amount)


async def deduct_credits(
    org_id: str,
    amount: int,
    source: str,
    ref_id: str | None = None,
    desc: str | None = None,
    metadata: dict | None = None,
) -> int:
    """Deduct credits after generation succeeds. Returns new balance (-1 = unlimited)."""
    return await _provider.deduct(org_id, amount, source, ref_id, desc, metadata)


async def get_balance(org_id: str) -> int:
    """Get current credit balance (-1 = unlimited)."""
    return await _provider.get_balance(org_id)


async def refund_credits(
    org_id: str,
    amount: int,
    source: str,
    ref_id: str | None = None,
    desc: str | None = None,
) -> int:
    """Refund credits (positive amount). Returns new balance (-1 = unlimited)."""
    return await _provider.refund(org_id, amount, source, ref_id, desc)


__all__ = [
    "CreditProvider",
    "UnlimitedCredits",
    "InsufficientCreditsError",
    "set_credit_provider",
    "check_credits",
    "deduct_credits",
    "get_balance",
    "refund_credits",
]
