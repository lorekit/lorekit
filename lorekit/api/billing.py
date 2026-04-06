"""Billing API endpoints — credit balance, usage, checkout, portal.

In open source mode: balance returns unlimited, checkout/portal return 404.
In cloud mode: cloud/startup.py injects real Stripe handlers.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.billing import get_balance

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])

# Handler registry — cloud/ injects real handlers at startup
_handlers: dict[str, Any] = {}


def register_billing_handlers(handlers: dict[str, Any]) -> None:
    """Register cloud billing handlers (called by cloud/startup.py)."""
    _handlers.update(handlers)


def _get_handler(name: str) -> Any:
    handler = _handlers.get(name)
    if not handler:
        raise HTTPException(
            status_code=404,
            detail="Billing not available in self-hosted mode",
        )
    return handler


# ---- Request models ----

class CheckoutRequest(BaseModel):
    price_id: str
    success_url: str = "/app/settings/billing?success=true"
    cancel_url: str = "/app/settings/billing?canceled=true"


class PaygRequest(BaseModel):
    credits: int = 1000
    success_url: str = "/app/settings/billing?success=true"
    cancel_url: str = "/app/settings/billing?canceled=true"


# ---- Endpoints ----

@router.get("/subscription")
async def get_subscription(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get current subscription + credit balance.

    Works in both modes: OS returns unlimited, cloud returns real balance.
    """
    balance = await get_balance(user.org_id)

    result: dict[str, Any] = {
        "balance": balance,
        "unlimited": balance == -1,
    }

    # If cloud handler is available, get subscription details
    handler = _handlers.get("get_subscription")
    if handler:
        sub = await handler(user.org_id)
        if sub:
            result.update({
                "plan_tier": sub.get("plan_tier"),
                "plan_credits": sub.get("plan_credits"),
                "status": sub.get("status"),
                "current_period_end": sub.get("current_period_end"),
                "billing_interval": sub.get("billing_interval"),
                "auto_refill_enabled": bool(sub.get("auto_refill_enabled")),
                "auto_refill_threshold": sub.get("auto_refill_threshold", 100),
                "auto_refill_credits": sub.get("auto_refill_credits", 1000),
            })

    return result


@router.get("/usage")
async def get_usage(
    user: CurrentUser = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Get credit usage history (ledger entries)."""
    balance = await get_balance(user.org_id)
    if balance == -1:
        return {"entries": [], "total": 0, "unlimited": True}

    pool = await db.get_pool()
    rows = await pool.fetch(
        """SELECT id, amount, balance_after, source, reference_id,
                  description, metadata_json, created_at
           FROM credit_ledger
           WHERE organization_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3""",
        user.org_id, limit, offset,
    )
    count_row = await pool.fetchrow(
        "SELECT COUNT(*) as total FROM credit_ledger WHERE organization_id = $1",
        user.org_id,
    )

    entries = [dict(r) for r in rows]
    return {
        "entries": entries,
        "total": count_row["total"] if count_row else 0,
        "unlimited": False,
    }


@router.get("/analytics")
async def get_analytics(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get billing analytics — burn rate, breakdown by type, top projects."""
    balance = await get_balance(user.org_id)
    if balance == -1:
        return {"daily_usage": [], "by_source": [], "top_projects": [], "burn_rate": 0, "days_remaining": None}

    pool = await db.get_pool()

    # Daily usage over last 30 days (debits only)
    daily_rows = await pool.fetch(
        """SELECT DATE(created_at) as date, SUM(ABS(amount)) as credits
           FROM credit_ledger
           WHERE organization_id = $1 AND amount < 0
             AND created_at >= (NOW() - INTERVAL '30 days')::text
           GROUP BY DATE(created_at)
           ORDER BY date""",
        user.org_id,
    )
    daily_usage = [{"date": str(r["date"]), "credits": r["credits"]} for r in daily_rows]

    # Breakdown by source (debits only, last 30 days)
    source_rows = await pool.fetch(
        """SELECT source, SUM(ABS(amount)) as total
           FROM credit_ledger
           WHERE organization_id = $1 AND amount < 0
             AND created_at >= (NOW() - INTERVAL '30 days')::text
           GROUP BY source
           ORDER BY total DESC""",
        user.org_id,
    )
    by_source = [{"source": r["source"], "total": r["total"]} for r in source_rows]

    # Top projects by credit usage
    project_rows = await pool.fetch(
        """SELECT reference_id, SUM(ABS(amount)) as total,
                  MAX(description) as description
           FROM credit_ledger
           WHERE organization_id = $1 AND amount < 0 AND reference_id IS NOT NULL
             AND created_at >= (NOW() - INTERVAL '30 days')::text
           GROUP BY reference_id
           ORDER BY total DESC
           LIMIT 5""",
        user.org_id,
    )
    top_projects = [
        {"reference_id": r["reference_id"], "total": r["total"], "description": r["description"] or ""}
        for r in project_rows
    ]

    # Burn rate (average daily usage over last 7 days)
    burn_row = await pool.fetchrow(
        """SELECT COALESCE(SUM(ABS(amount)), 0) / GREATEST(1,
             EXTRACT(DAY FROM NOW() - MIN(created_at::timestamp))::int) as rate
           FROM credit_ledger
           WHERE organization_id = $1 AND amount < 0
             AND created_at >= (NOW() - INTERVAL '7 days')::text""",
        user.org_id,
    )
    burn_rate = int(burn_row["rate"]) if burn_row else 0

    # Days remaining
    days_remaining = None
    if burn_rate > 0 and balance > 0:
        days_remaining = balance // burn_rate

    return {
        "daily_usage": daily_usage,
        "by_source": by_source,
        "top_projects": top_projects,
        "burn_rate": burn_rate,
        "days_remaining": days_remaining,
    }


@router.get("/usage/by-member")
async def get_usage_by_member(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get credit usage breakdown by team member (last 30 days)."""
    balance = await get_balance(user.org_id)
    if balance == -1:
        return {"members": []}

    pool = await db.get_pool()
    rows = await pool.fetch(
        """SELECT user_id, SUM(ABS(amount)) as total_credits, COUNT(*) as actions
           FROM credit_ledger
           WHERE organization_id = $1 AND amount < 0 AND user_id IS NOT NULL
             AND created_at >= (NOW() - INTERVAL '30 days')::text
           GROUP BY user_id
           ORDER BY total_credits DESC""",
        user.org_id,
    )
    return {
        "members": [
            {"user_id": r["user_id"], "total_credits": r["total_credits"], "actions": r["actions"]}
            for r in rows
        ],
    }


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Create Stripe Checkout session for a new subscription."""
    handler = _get_handler("create_checkout")
    return await handler(
        user.org_id, body.price_id, body.success_url, body.cancel_url,
        email=user.email,
    )


@router.post("/checkout/payg")
async def create_payg_checkout(
    body: PaygRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Create Stripe Checkout session for PAYG credit pack."""
    handler = _get_handler("create_payg_checkout")
    return await handler(
        user.org_id, body.credits, body.success_url, body.cancel_url,
        email=user.email,
    )


class AutoRefillRequest(BaseModel):
    enabled: bool = False
    threshold: int = 100
    credits: int = 1000


@router.put("/auto-refill")
async def update_auto_refill(
    body: AutoRefillRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Update auto-refill settings for the org."""
    balance = await get_balance(user.org_id)
    if balance == -1:
        raise HTTPException(status_code=404, detail="Billing not available in self-hosted mode")

    pool = await db.get_pool()
    await pool.execute(
        "UPDATE subscriptions SET auto_refill_enabled = $2, auto_refill_threshold = $3, "
        "auto_refill_credits = $4, updated_at = $5 WHERE organization_id = $1",
        user.org_id, int(body.enabled), body.threshold, body.credits,
        datetime.now(timezone.utc).isoformat(),
    )
    return {"ok": True}


@router.post("/portal")
async def create_portal(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Create Stripe Customer Portal session."""
    handler = _get_handler("create_portal")
    return await handler(user.org_id)


@router.post("/webhooks")
async def stripe_webhook(request: Request) -> Any:
    """Stripe webhook handler — no auth (Stripe calls this directly)."""
    handler = _get_handler("stripe_webhook")
    return await handler(request)
