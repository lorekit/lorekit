"""Waitlist / pre-launch signup endpoint — public, no auth required."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from lorekit import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")


class WaitlistRequest(BaseModel):
    email: EmailStr
    signup_type: str
    company_name: str | None = None
    role: str | None = None
    monthly_ad_spend: str | None = None


@router.post("")
async def create_waitlist_signup(body: WaitlistRequest) -> dict:
    if body.signup_type not in ("cloud_signup", "demo_request"):
        raise HTTPException(status_code=400, detail="Invalid signup_type")

    pool = await db.get_pool()
    signup_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    await pool.execute(
        """INSERT INTO waitlist_signups (id, email, signup_type, company_name, role, monthly_ad_spend, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        signup_id,
        body.email,
        body.signup_type,
        body.company_name,
        body.role,
        body.monthly_ad_spend,
        "pricing_page",
        now,
    )

    if SLACK_WEBHOOK_URL:
        try:
            label = "Cloud Signup" if body.signup_type == "cloud_signup" else "Demo Request"
            parts = [f"New {label}: {body.email}"]
            if body.company_name:
                parts.append(f"Company: {body.company_name}")
            if body.role:
                parts.append(f"Role: {body.role}")
            if body.monthly_ad_spend:
                parts.append(f"Monthly Ad Spend: {body.monthly_ad_spend}")
            async with httpx.AsyncClient() as client:
                await client.post(
                    SLACK_WEBHOOK_URL,
                    json={"text": "\n".join(parts)},
                    timeout=5.0,
                )
        except Exception:
            logger.warning("Failed to send Slack notification", exc_info=True)

    return {"ok": True, "id": signup_id}
