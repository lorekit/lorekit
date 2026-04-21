"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Code, Loader2, Sparkles } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { API_BASE } from "@/lib/api";

type FormStatus = "idle" | "loading" | "success" | "error";

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  async function handleCloudSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, signup_type: "cloud_signup" }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="pt-16 sm:pt-24 pb-8 sm:pb-10 px-4 sm:px-6 text-center starfield">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-slate-500 uppercase tracking-wider mb-3">Pricing</p>
          <h1 className="text-3xl sm:text-5xl font-logo font-bold text-white tracking-wide leading-tight">
            Your AI ad team,{" "}
            <span className="text-amber-400" style={{ textShadow: "0 0 20px rgba(251,191,36,0.3)" }}>
              on demand.
            </span>
          </h1>
        </div>
      </section>

      {/* Two cards: Done-For-You + Cloud */}
      <section className="border-t border-slate-800/50 pt-8 sm:pt-12 pb-16 sm:pb-24 px-4 sm:px-6 starfield">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Done-For-You — left card */}
          <div className="rounded-2xl bg-slate-900 border border-amber-500/30 p-6 sm:p-8 flex flex-col">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-4">Starting at</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-1">$5,000 USD / Month</h2>
            <p className="text-sm text-slate-400 mt-4 mb-6 leading-relaxed">
              We build and run your AI video ad pipeline. You get 10-100+ strategically developed video ads per week to test in multiple styles, with multiple angles, aimed at multiple personas. Find winners faster. You control the brief and edits from the platform, and we make sure your ads get uploaded the way you like into your Meta and other accounts.
            </p>
            <Link
              href="/contact"
              className="btn-shimmer rounded-full px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2"
            >
              See a Demo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Cloud — right card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">LoreKit Cloud</h3>
            <ul className="space-y-2.5 mb-6 flex-1">
              {[
                "Access to the LoreKit platform",
                "A dedicated AI video production pipeline",
                "A Slack channel for smooth communication",
                "Access to the editor to edit copy and VO easily",
                "Custom brand universe setup",
                "Priority generation queue",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-400">{f}</span>
                </li>
              ))}
            </ul>

            {status === "success" ? (
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-5 text-center">
                <div className="text-2xl mb-2">&#10003;</div>
                <p className="text-sm font-medium text-amber-400">You&apos;re on the list!</p>
              </div>
            ) : (
              <form onSubmit={handleCloudSignup} className="flex flex-col gap-3">
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="rounded-full px-4 py-2.5 text-sm font-medium text-center bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Join Waitlist
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
                {status === "error" && (
                  <p className="text-xs text-red-400 text-center">Something went wrong. Please try again.</p>
                )}
              </form>
            )}
          </div>

        </div>
      </section>

      {/* Open Source */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl bg-slate-900 border border-green-500/20 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Code className="h-5 w-5 text-green-400" />
                  <h3 className="text-lg font-bold text-white">Open Source</h3>
                </div>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-md">
                  The free tier is the whole product. Self-host LoreKit with your own API keys. MIT licensed, no limits, no credit card required.
                </p>
                <div className="mt-5">
                  <a
                    href="https://github.com/lorekit/lorekit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full px-5 py-2.5 text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors inline-flex items-center gap-2"
                  >
                    View on GitHub
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                {[
                  "Full source code (MIT license)",
                  "Bring your own API keys",
                  "Unlimited everything",
                  "All generation features",
                  "All AI models",
                  "No credit card required",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-2 py-1">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-400">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
