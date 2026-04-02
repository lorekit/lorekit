/**
 * Environment mode detection for LoreKit.
 *
 * Cloud mode is enabled when Better Auth is configured.
 * Open-source mode is the default (no auth, single user).
 */

/** Check if running in cloud mode (server-side). */
export function isCloudMode(): boolean {
  if (typeof window === "undefined") {
    return !!process.env.BETTER_AUTH_SECRET;
  }
  return !!process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
}

/** Get the backend API base URL. */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
}

/** Get the MCP HTTP endpoint URL. */
export function getMcpHttpUrl(): string {
  return `${getApiBaseUrl()}/mcp/mcp`;
}
