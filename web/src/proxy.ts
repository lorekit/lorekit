import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Content Security Policy — mitigates XSS (critical given localStorage token storage)
  const csp = [
    "default-src 'self'",
    // Scripts: self + Next.js inline scripts (nonce would be better but requires custom server)
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // Styles: self + inline (Tailwind)
    "style-src 'self' 'unsafe-inline'",
    // Images: self + data URIs + Supabase storage + fal.ai CDN
    "img-src 'self' data: blob: http://localhost:8001 https://*.supabase.co https://*.fal.ai https://fal.media",
    // Media: self + blob + Supabase + fal.ai
    "media-src 'self' blob: http://localhost:8001 https://*.supabase.co https://*.fal.ai https://fal.media",
    // Fonts: self + Google Fonts
    "font-src 'self' data: https://fonts.gstatic.com",
    // Connect: self + API + Supabase + Stripe + fal.ai
    "connect-src 'self' http://localhost:8001 https://*.supabase.co https://*.stripe.com https://*.fal.ai https://fal.media wss://*.supabase.co",
    // Frames: Stripe checkout
    "frame-src 'self' https://*.stripe.com",
    // No embedding this site in iframes (clickjacking protection)
    "frame-ancestors 'none'",
    // Form actions: self only
    "form-action 'self'",
    // Base URI: self only
    "base-uri 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Clickjacking protection (redundant with frame-ancestors but broader browser support)
  response.headers.set("X-Frame-Options", "DENY");

  // Referrer policy — don't leak full URLs to external sites
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — disable unnecessary browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  return response;
}

export const config = {
  // Apply to all routes except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
