"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Shield, Check, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const SCOPE_LABELS: Record<string, string> = {
  openid: "Verify your identity",
  profile: "Access your name and profile",
  email: "Access your email address",
  offline_access: "Stay connected when you're not using the app",
};

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>}>
      <OAuthConsentContent />
    </Suspense>
  );
}

function OAuthConsentContent() {
  const searchParams = useSearchParams();
  const clientName = searchParams.get("client_name") || "An application";
  const scopeParam = searchParams.get("scope") || "openid profile email";
  const scopes = scopeParam.split(" ").filter(Boolean);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConsent(accept: boolean) {
    setLoading(true);
    setError(null);

    try {
      await (authClient as any).oauth2.consent({
        accept,
        scope: accept ? scopeParam : "",
      });
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Shield className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Authorize Access</h1>
              <p className="text-sm text-slate-400">
                <span className="text-white font-medium">{clientName}</span> wants to access your LoreKit account
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-8">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">
              This will allow the application to:
            </p>
            {scopes.map((scope) => (
              <div
                key={scope}
                className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg"
              >
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-slate-300">
                  {SCOPE_LABELS[scope] || scope}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-400 mb-4">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleConsent(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Deny
            </Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
              onClick={() => handleConsent(true)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Authorize
            </Button>
          </div>

          <p className="text-xs text-slate-500 text-center mt-6">
            You can revoke access at any time from your settings.
          </p>
        </div>
      </div>
    </div>
  );
}
