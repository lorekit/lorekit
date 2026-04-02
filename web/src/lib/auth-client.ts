import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Better Auth client — used in React components for login, signup,
 * session management, and organization operations.
 *
 * The bearer token from sign-in is stored in localStorage and injected
 * into API calls by the fetchAPI() function in api.ts.
 */
export const isCloud = !!process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3001",
  plugins: isCloud ? [organizationClient()] : [],
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
}
