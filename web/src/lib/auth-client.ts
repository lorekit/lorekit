import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { stripeClient } from "@better-auth/stripe/client";

/**
 * Better Auth client — used in React components for login, signup,
 * session management, organization operations, and Stripe billing.
 *
 * The bearer token from sign-in is stored in localStorage and injected
 * into API calls by the fetchAPI() function in api.ts.
 */
export const isCloud = !!process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
const hasStripe = !!process.env.NEXT_PUBLIC_STRIPE_TEST_MODE || !!process.env.NEXT_PUBLIC_STRIPE_ENABLED;

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3001",
  plugins: isCloud
    ? [
        organizationClient(),
        oauthProviderClient(),
        ...(hasStripe ? [stripeClient({ subscription: true })] : []),
      ]
    : [],
  fetchOptions: isCloud
    ? {
        onSuccess: (ctx) => {
          // Store bearer token for API calls to FastAPI backend
          const authToken = ctx.response.headers.get("set-auth-token");
          if (authToken) {
            localStorage.setItem("lorekit_token", authToken);
          }
        },
      }
    : undefined,
});

/**
 * Get the stored bearer token for API calls.
 * Returns null in open source mode (no auth).
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lorekit_token");
}

/**
 * Clear auth state on logout.
 */
export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("lorekit_token");
  localStorage.removeItem("lorekit_token_expires");
}

/**
 * Refresh the bearer token by calling BA's getSession endpoint.
 * Returns true if a fresh token was obtained, false otherwise.
 */
export async function refreshAuthToken(): Promise<boolean> {
  if (!isCloud) return false;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3001"}/api/auth/get-session`,
      { credentials: "include" },
    );
    if (!res.ok) return false;
    const token = res.headers.get("set-auth-token");
    if (token) {
      localStorage.setItem("lorekit_token", token);
      return true;
    }
  } catch {
    // Session cookie expired or invalid
  }
  return false;
}
