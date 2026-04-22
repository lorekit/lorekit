import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { waitlistSignups } from "@drizzle/schema";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, signup_type, company_name, role, monthly_ad_spend } = body;

    if (!email || !signup_type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const trimmedEmail = email.toLowerCase().trim();

    await db.insert(waitlistSignups).values({
      id: randomUUID().slice(0, 12),
      email: trimmedEmail,
      signupType: signup_type,
      companyName: company_name || null,
      role: role || null,
      monthlyAdSpend: monthly_ad_spend || null,
      source: signup_type === "demo_request" ? "contact_page" : "pricing_page",
      createdAt: new Date().toISOString(),
    });

    // Slack notification
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      try {
        const label = signup_type === "cloud_signup" ? "Cloud Signup" : "Demo Request";
        const parts = [`New ${label}: ${trimmedEmail}`];
        if (company_name) parts.push(`Company: ${company_name}`);
        if (role) parts.push(`Role: ${role}`);
        if (monthly_ad_spend) parts.push(`Monthly Ad Spend: ${monthly_ad_spend}`);
        await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: parts.join("\n") }),
        });
      } catch {
        console.warn("Failed to send Slack notification");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Waitlist signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
