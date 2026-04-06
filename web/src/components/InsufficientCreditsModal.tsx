"use client";

import { useState, useEffect } from "react";
import { AlertCircle, X, Coins, ArrowUpRight } from "lucide-react";
import { isCloud } from "@/lib/auth-client";

export function InsufficientCreditsModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("Insufficient credits");

  useEffect(() => {
    function handleEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      setMessage(detail || "Insufficient credits");
      setOpen(true);
    }
    window.addEventListener("lorekit:insufficient-credits", handleEvent);
    return () => window.removeEventListener("lorekit:insufficient-credits", handleEvent);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Out of Credits</h2>
            <p className="text-sm text-slate-400">{message}</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-6">
          You don&apos;t have enough credits to complete this action.
          {isCloud
            ? " Purchase additional credits or upgrade your plan to continue generating."
            : " This shouldn't happen in self-hosted mode. Check your billing configuration."}
        </p>

        {isCloud && (
          <div className="flex gap-3">
            <a
              href="/app/settings/billing"
              onClick={() => setOpen(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-black hover:bg-amber-400 transition-colors"
            >
              <Coins className="h-4 w-4" />
              Buy Credits
            </a>
            <a
              href="/pricing"
              onClick={() => setOpen(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Upgrade Plan
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        )}

        {!isCloud && (
          <button
            onClick={() => setOpen(false)}
            className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
