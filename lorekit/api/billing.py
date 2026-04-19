"""Billing API endpoints — credit balance, usage, PAYG checkout, internal hooks.

In open source mode: balance returns unlimited, PAYG/internal return 404.
In cloud mode: cloud/startup.py injects real handlers. Subscription checkout,
portal, and webhooks are handled by Better Auth's Stripe plugin.
"""

from __future__ import annotations

import hmac
import logging
import os
import uuid
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

INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")


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


def _require_billing_admin(user: CurrentUser) -> None:
    """Require owner or admin role for billing mutations."""
    if user.role not in ("owner", "admin"):
        raise HTTPException(status_code=404, detail="Not found")


def _verify_internal(request: Request) -> None:
    """Verify request comes from our own Next.js process using constant-time comparison."""
    if not INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Internal API not configured")
    secret = request.headers.get("x-internal-secret", "")
    if not hmac.compare_digest(secret.encode(), INTERNAL_API_SECRET.encode()):
        raise HTTPException(status_code=403, detail="Forbidden")


# ---- Request models ----

class PaygRequest(BaseModel):
    credits: int = 1000
    success_url: str = "/app/settings/billing?success=true"
    cancel_url: str = "/app/settings/billing?canceled=true"


class InternalCreditsAddRequest(BaseModel):
    org_id: str
    credits: int
    source: str = "subscription_refill"
    ref_id: str | None = None
    description: str | None = None
    monthly_allowance: int | None = None
    plan_tier: str | None = None
    plan_credits: int | None = None


class InternalSubscriptionUpdatedRequest(BaseModel):
    org_id: str
    plan: str | None = None
    status: str | None = None


class InternalInvoicePaidRequest(BaseModel):
    stripe_subscription_id: str


class InternalPaymentFailedRequest(BaseModel):
    stripe_subscription_id: str


class InternalSubscriptionDeletedRequest(BaseModel):
    org_id: str


# ---- Endpoints ----

@router.get("/subscription")
async def get_subscription(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get current subscription + credit balance.

    Works in both modes: OS returns unlimited, cloud returns real balance.
    Reads subscription state from BA's subscription table + subscription_extras.
    """
    balance = await get_balance(user.org_id)

    result: dict[str, Any] = {
        "balance": balance,
        "unlimited": balance == -1,
    }

    pool = await db.get_pool()

    # Read from BA's subscription table (referenceId = org_id)
    sub_row = await pool.fetchrow(
        """SELECT s.plan, s.status, s."periodStart", s."periodEnd",
                  se.plan_credits, se.auto_refill_enabled, se.auto_refill_threshold,
                  se.auto_refill_credits
           FROM subscription s
           LEFT JOIN subscription_extras se ON se.organization_id = s."referenceId"
           WHERE s."referenceId" = $1
             AND s.status IN ('active', 'trialing', 'past_due')
           ORDER BY s."createdAt" DESC
           LIMIT 1""",
        user.org_id,
    )

    if sub_row:
        plan_name = sub_row["plan"] or ""
        tier = "creator"
        if plan_name.startswith("studio"): tier = "studio"
        elif plan_name.startswith("pro"): tier = "pro"
        interval = "year" if "annual" in plan_name else "month"

        result.update({
            "plan_tier": tier,
            "plan_credits": sub_row["plan_credits"],
            "status": sub_row["status"],
            "current_period_end": sub_row["periodEnd"],
            "billing_interval": interval,
            "auto_refill_enabled": bool(sub_row["auto_refill_enabled"]) if sub_row["auto_refill_enabled"] is not None else False,
            "auto_refill_threshold": sub_row["auto_refill_threshold"] or 100,
            "auto_refill_credits": sub_row["auto_refill_credits"] or 1000,
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
    _require_billing_admin(user)
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


@router.post("/checkout/payg")
async def create_payg_checkout(
    body: PaygRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Create Stripe Checkout session for PAYG credit pack."""
    _require_billing_admin(user)
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
    _require_billing_admin(user)
    balance = await get_balance(user.org_id)
    if balance == -1:
        raise HTTPException(status_code=404, detail="Billing not available in self-hosted mode")

    pool = await db.get_pool()
    now = datetime.now(timezone.utc).isoformat()
    await pool.execute(
        """INSERT INTO subscription_extras (id, organization_id, auto_refill_enabled,
           auto_refill_threshold, auto_refill_credits, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)
           ON CONFLICT (organization_id) DO UPDATE SET
           auto_refill_enabled = $3, auto_refill_threshold = $4,
           auto_refill_credits = $5, updated_at = $6""",
        uuid.uuid4().hex, user.org_id, int(body.enabled), body.threshold, body.credits, now,
    )
    return {"ok": True}


# ---- Internal endpoints (called by BA Stripe hooks in Next.js) ----

@router.post("/internal/credits-add")
async def internal_credits_add(body: InternalCreditsAddRequest, request: Request) -> dict:
    """Add credits for a new subscription or refill. Called by BA onSubscriptionComplete."""
    _verify_internal(request)
    from lorekit.billing import get_credit_provider
    provider = get_credit_provider()

    await provider.add_credits(
        body.org_id, body.credits, body.source,
        ref_id=body.ref_id, desc=body.description,
        monthly_allowance=body.monthly_allowance,
    )

    # Upsert subscription_extras with plan info
    if body.plan_tier:
        pool = await db.get_pool()
        now = datetime.now(timezone.utc).isoformat()
        await pool.execute(
            """INSERT INTO subscription_extras (id, organization_id, plan_credits, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $4)
               ON CONFLICT (organization_id) DO UPDATE SET
               plan_credits = $3, updated_at = $4""",
            uuid.uuid4().hex, body.org_id, body.plan_credits or body.credits, now,
        )

    await _log_billing_event(body.org_id, "credits_added", body.description)
    return {"ok": True}


@router.post("/internal/invoice-paid")
async def internal_invoice_paid(body: InternalInvoicePaidRequest, request: Request) -> dict:
    """Monthly credit refill on invoice.paid. Called by BA onEvent."""
    _verify_internal(request)

    pool = await db.get_pool()
    row = await pool.fetchrow(
        """SELECT se.organization_id, se.plan_credits
           FROM subscription s
           JOIN subscription_extras se ON se.organization_id = s."referenceId"
           WHERE s."stripeSubscriptionId" = $1""",
        body.stripe_subscription_id,
    )
    if not row:
        logger.warning("Invoice paid for unknown subscription: %s", body.stripe_subscription_id)
        return {"ok": False, "reason": "unknown_subscription"}

    from lorekit.billing import get_credit_provider
    provider = get_credit_provider()
    await provider.add_credits(
        row["organization_id"], row["plan_credits"], "subscription_refill",
        ref_id=body.stripe_subscription_id,
        desc=f"Monthly credit refill ({row['plan_credits']} credits)",
        monthly_allowance=row["plan_credits"],
    )

    logger.info("Monthly refill: org=%s credits=%d", row["organization_id"], row["plan_credits"])
    return {"ok": True}


@router.post("/internal/payment-failed")
async def internal_payment_failed(body: InternalPaymentFailedRequest, request: Request) -> dict:
    """Handle payment failure. Called by BA onEvent."""
    _verify_internal(request)

    pool = await db.get_pool()
    row = await pool.fetchrow(
        """SELECT se.organization_id
           FROM subscription s
           JOIN subscription_extras se ON se.organization_id = s."referenceId"
           WHERE s."stripeSubscriptionId" = $1""",
        body.stripe_subscription_id,
    )
    if row:
        await _log_billing_event(row["organization_id"], "payment_failed")
        logger.warning("Payment failed for subscription: %s", body.stripe_subscription_id)

    return {"ok": True}


@router.post("/internal/subscription-updated")
async def internal_subscription_updated(
    body: InternalSubscriptionUpdatedRequest, request: Request,
) -> dict:
    """Sync plan changes from BA subscription update."""
    _verify_internal(request)

    if body.plan:
        # Derive credits from plan name
        plan_credits_map = {
            "creator": 1500, "pro_4000": 4000, "pro_5500": 5500,
            "pro_7000": 7000, "pro_8000": 8000, "studio_10000": 10000,
            "studio_15000": 15000, "studio_20000": 20000, "studio_25000": 25000,
        }
        base_plan = body.plan.replace("_monthly", "").replace("_annual", "")
        credits = plan_credits_map.get(base_plan, 1500)

        pool = await db.get_pool()
        now = datetime.now(timezone.utc).isoformat()
        await pool.execute(
            """INSERT INTO subscription_extras (id, organization_id, plan_credits, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $4)
               ON CONFLICT (organization_id) DO UPDATE SET
               plan_credits = $3, updated_at = $4""",
            uuid.uuid4().hex, body.org_id, credits, now,
        )

        # Update monthly allowance in credit_balances
        await pool.execute(
            "UPDATE credit_balances SET monthly_allowance = $2, updated_at = $3 WHERE organization_id = $1",
            body.org_id, credits, now,
        )

    return {"ok": True}


@router.post("/internal/subscription-deleted")
async def internal_subscription_deleted(
    body: InternalSubscriptionDeletedRequest, request: Request,
) -> dict:
    """Handle subscription cancellation from BA."""
    _verify_internal(request)
    await _log_billing_event(body.org_id, "subscription_canceled")
    return {"ok": True}


async def _log_billing_event(
    org_id: str, event_type: str, description: str | None = None,
) -> None:
    """Record a billing lifecycle event for audit trail."""
    try:
        pool = await db.get_pool()
        await pool.execute(
            "INSERT INTO billing_events (id, organization_id, event_type, description, created_at) "
            "VALUES ($1, $2, $3, $4, $5)",
            uuid.uuid4().hex, org_id, event_type, description,
            datetime.now(timezone.utc).isoformat(),
        )
    except Exception:
        logger.warning("Failed to log billing event: %s for org %s", event_type, org_id)
