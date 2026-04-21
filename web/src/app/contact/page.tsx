"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { API_BASE } from "@/lib/api";

type FormStatus = "idle" | "loading" | "success" | "error";

export default function ContactPage() {
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyAdSpend, setMonthlyAdSpend] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          signup_type: "demo_request",
          company_name: companyName || null,
          role: role || null,
          monthly_ad_spend: monthlyAdSpend || null,
        }),
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

      <section className="flex-1 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-start">
          {/* Left — headline */}
          <div>
            <h1 className="text-3xl sm:text-5xl font-logo font-bold text-white tracking-wide leading-tight">
              Let&apos;s talk
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-md leading-relaxed">
              We&apos;d love to learn more about your team and goals.
            </p>
          </div>

          {/* Right — form */}
          <div>
            <p className="text-sm sm:text-base text-slate-300 mb-8 leading-relaxed">
              Talk to our team and see how LoreKit combines AI + your brand assets to produce top-performing ads — faster.
            </p>

            {status === "success" ? (
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-8 text-center">
                <div className="text-3xl mb-3">&#10003;</div>
                <p className="text-base font-medium text-amber-400">Thanks! We&apos;ll be in touch soon.</p>
                <p className="text-sm text-slate-400 mt-2">We typically respond within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Your Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Work Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Monthly Spend on Meta Ads</label>
                  <input
                    type="text"
                    value={monthlyAdSpend}
                    onChange={(e) => setMonthlyAdSpend(e.target.value)}
                    placeholder="e.g. $5,000"
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="btn-shimmer rounded-full px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 mt-2"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Submit
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

      <PublicFooter />
    </div>
  );
}
