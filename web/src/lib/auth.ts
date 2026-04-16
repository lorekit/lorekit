import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { bearer } from "better-auth/plugins";
import { jwt } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { oauthProvider } from "@better-auth/oauth-provider";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

/**
 * Better Auth server config — runs in Next.js API routes.
 *
 * In open source mode (no DATABASE_URL / BETTER_AUTH_SECRET), this file
 * is never imported — the app skips auth entirely.
 *
 * In cloud mode, this powers /api/auth/* endpoints for login, signup,
 * session management, OAuth, organization management, and Stripe billing.
 */

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

if (process.env.STRIPE_SECRET_KEY && !INTERNAL_API_SECRET) {
  throw new Error(
    "INTERNAL_API_SECRET must be set when Stripe billing is enabled. " +
    "Generate one with: openssl rand -hex 32"
  );
}

async function callInternalAPI(path: string, body: Record<string, unknown>) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${FASTAPI_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": INTERNAL_API_SECRET!,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      console.error(
        `Internal API call failed: ${path} (${res.status}) attempt ${attempt}/${maxRetries}`,
        await res.text().catch(() => ""),
      );
    } catch (e) {
      console.error(`Internal API call error: ${path} attempt ${attempt}/${maxRetries}`, e);
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  console.error(`Internal API call exhausted retries: ${path}`, JSON.stringify(body));
}

const stripePlugin = process.env.STRIPE_SECRET_KEY
  ? stripe({
      stripeClient: new Stripe(process.env.STRIPE_SECRET_KEY!),
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      organization: { enabled: true },
      subscription: {
        enabled: true,
        plans: [
          // Creator
          { name: "creator_monthly", priceId: process.env.STRIPE_PRICE_CREATOR_MONTHLY || "" },
          { name: "creator_annual", priceId: process.env.STRIPE_PRICE_CREATOR_ANNUAL || "" },
          // Pro tiers
          { name: "pro_4000_monthly", priceId: process.env.STRIPE_PRICE_PRO_4000_MONTHLY || "" },
          { name: "pro_5500_monthly", priceId: process.env.STRIPE_PRICE_PRO_5500_MONTHLY || "" },
          { name: "pro_7000_monthly", priceId: process.env.STRIPE_PRICE_PRO_7000_MONTHLY || "" },
          { name: "pro_8000_monthly", priceId: process.env.STRIPE_PRICE_PRO_8000_MONTHLY || "" },
          { name: "pro_4000_annual", priceId: process.env.STRIPE_PRICE_PRO_4000_ANNUAL || "" },
          { name: "pro_5500_annual", priceId: process.env.STRIPE_PRICE_PRO_5500_ANNUAL || "" },
          { name: "pro_7000_annual", priceId: process.env.STRIPE_PRICE_PRO_7000_ANNUAL || "" },
          { name: "pro_8000_annual", priceId: process.env.STRIPE_PRICE_PRO_8000_ANNUAL || "" },
          // Studio tiers
          { name: "studio_10000_monthly", priceId: process.env.STRIPE_PRICE_STUDIO_10000_MONTHLY || "" },
          { name: "studio_15000_monthly", priceId: process.env.STRIPE_PRICE_STUDIO_15000_MONTHLY || "" },
          { name: "studio_20000_monthly", priceId: process.env.STRIPE_PRICE_STUDIO_20000_MONTHLY || "" },
          { name: "studio_25000_monthly", priceId: process.env.STRIPE_PRICE_STUDIO_25000_MONTHLY || "" },
          { name: "studio_10000_annual", priceId: process.env.STRIPE_PRICE_STUDIO_10000_ANNUAL || "" },
          { name: "studio_15000_annual", priceId: process.env.STRIPE_PRICE_STUDIO_15000_ANNUAL || "" },
          { name: "studio_20000_annual", priceId: process.env.STRIPE_PRICE_STUDIO_20000_ANNUAL || "" },
          { name: "studio_25000_annual", priceId: process.env.STRIPE_PRICE_STUDIO_25000_ANNUAL || "" },
        ],
        onSubscriptionComplete: async ({ subscription, plan }) => {
          const orgId = subscription.referenceId;
          const credits = planCredits(plan.name);
          const tier = planTier(plan.name);
          await callInternalAPI("/api/billing/internal/credits-add", {
            org_id: orgId,
            credits,
            source: "subscription_refill",
            ref_id: subscription.stripeSubscriptionId,
            description: `Initial ${tier} subscription (${credits} credits)`,
            monthly_allowance: credits,
            plan_tier: tier,
            plan_credits: credits,
          });
        },
        onSubscriptionUpdate: async ({ subscription }) => {
          const orgId = subscription.referenceId;
          await callInternalAPI("/api/billing/internal/subscription-updated", {
            org_id: orgId,
            plan: subscription.plan,
            status: subscription.status,
          });
        },
        onSubscriptionDeleted: async ({ subscription }) => {
          const orgId = subscription.referenceId;
          await callInternalAPI("/api/billing/internal/subscription-deleted", {
            org_id: orgId,
          });
        },
      },
      onEvent: async (event) => {
        const eventType = event.type;

        if (eventType === "invoice.paid") {
          const invoice = event.data.object as unknown as Record<string, unknown>;
          if (invoice.billing_reason === "subscription_create") return;
          const subscriptionId = invoice.subscription as string;
          if (!subscriptionId) return;
          await callInternalAPI("/api/billing/internal/invoice-paid", {
            stripe_subscription_id: subscriptionId,
          });
        }

        if (eventType === "invoice.payment_failed") {
          const invoice = event.data.object as unknown as Record<string, unknown>;
          const subscriptionId = invoice.subscription as string;
          if (!subscriptionId) return;
          await callInternalAPI("/api/billing/internal/payment-failed", {
            stripe_subscription_id: subscriptionId,
          });
        }
      },
    })
  : null;

// Map plan names to credit amounts
const PLAN_CREDITS: Record<string, number> = {
  creator_monthly: 1500, creator_annual: 1500,
  pro_4000_monthly: 4000, pro_4000_annual: 4000,
  pro_5500_monthly: 5500, pro_5500_annual: 5500,
  pro_7000_monthly: 7000, pro_7000_annual: 7000,
  pro_8000_monthly: 8000, pro_8000_annual: 8000,
  studio_10000_monthly: 10000, studio_10000_annual: 10000,
  studio_15000_monthly: 15000, studio_15000_annual: 15000,
  studio_20000_monthly: 20000, studio_20000_annual: 20000,
  studio_25000_monthly: 25000, studio_25000_annual: 25000,
};

function planCredits(name: string): number {
  return PLAN_CREDITS[name] ?? 1500;
}

function planTier(name: string): string {
  if (name.startsWith("studio")) return "studio";
  if (name.startsWith("pro")) return "pro";
  return "creator";
}

export const auth = betterAuth({
  database: (() => {
    const isSupabase = process.env.DATABASE_URL?.includes("supabase.com");
    const certPath = path.join(process.cwd(), "certs", "prod-ca-2021.crt");
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isSupabase && fs.existsSync(certPath)
        ? { ca: fs.readFileSync(certPath).toString(), rejectUnauthorized: true }
        : undefined,
    });
  })(),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },

  rateLimit: {
    window: 60,    // 60 seconds
    max: 10,       // max 10 requests per window per IP
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
    ...(process.env.GITHUB_CLIENT_ID && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes — FastAPI can verify this JWT directly
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await auth.api.createOrganization({
              body: {
                name: `${user.name || user.email}'s workspace`,
                slug: `personal-${user.id.slice(0, 8)}`,
                userId: user.id,
              },
            });
          } catch (e) {
            console.error("Failed to auto-create personal org:", e);
          }
        },
      },
    },
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
    }),
    bearer(),
    jwt(),
    nextCookies(),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/oauth/consent",
      allowDynamicClientRegistration: true,
    }),
    ...(stripePlugin ? [stripePlugin] : []),
  ],
});

export type Session = typeof auth.$Infer.Session;
