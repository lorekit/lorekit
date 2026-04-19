"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Coins,
  ArrowUpRight,
  History,
  AlertCircle,
  ExternalLink,
  Infinity,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import {
  getSubscription,
  getUsageHistory,
  createPaygCheckout,
  updateAutoRefill,
  getBillingAnalytics,
  type Subscription,
  type LedgerEntry,
  type BillingAnalytics,
} from "@/lib/api";
import { authClient, isCloud } from "@/lib/auth-client";

const SOURCE_LABELS: Record<string, string> = {
  subscription_refill: "Monthly Refill",
  payg_purchase: "Credit Purchase",
  usage_video_clip: "Video Clip",
  usage_keyframe: "Keyframe",
  usage_story: "Story Generation",
  usage_tts: "TTS Narration",
  usage_transition: "Transition",
  usage_portrait: "Portrait",
  usage_render: "Render",
  refund: "Refund",
  admin_adjustment: "Adjustment",
};

const TIER_LABELS: Record<string, string> = {
  creator: "Creator",
  pro: "Pro",
  studio: "Studio",
};

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSubscription().catch(() => null),
      getUsageHistory(20).catch(() => ({ entries: [], total: 0, unlimited: false })),
    ]).then(([sub, usage]) => {
      setSubscription(sub);
      setEntries(usage?.entries || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-slate-800" />
          <div className="h-40 rounded-xl bg-slate-800" />
          <div className="h-60 rounded-xl bg-slate-800" />
        </div>
      </div>
    );
  }

  // Open source mode — unlimited
  if (!isCloud || subscription?.unlimited) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white mb-6">Billing</h1>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <Infinity className="mx-auto h-12 w-12 text-emerald-400 mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Unlimited Credits</h2>
          <p className="text-sm text-slate-400">
            Self-hosted mode uses your own API keys with no credit limits.
          </p>
        </div>
      </div>
    );
  }

  const balance = subscription?.balance ?? 0;
  const allowance = subscription?.plan_credits ?? 0;
  const usedPercent = allowance > 0 ? Math.min(100, ((allowance - balance) / allowance) * 100) : 0;
  const isLow = allowance > 0 && balance < allowance * 0.1;
  const tier = subscription?.plan_tier;

  async function handlePortal() {
    try {
      await (authClient as any).subscription.billingPortal({
        customerType: "organization",
        returnUrl: window.location.href,
        disableRedirect: false,
      });
    } catch {
      alert("Failed to open billing portal");
    }
  }

  async function handlePayg() {
    try {
      const { url } = await createPaygCheckout(1000);
      window.location.href = url;
    } catch {
      alert("Failed to create checkout");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <Link
          href="/app/settings"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back to Settings
        </Link>
      </div>

      {/* Current Plan Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Current Plan</h2>
            </div>
            {tier ? (
              <p className="text-2xl font-bold text-white">
                {TIER_LABELS[tier] || tier}
                {subscription?.billing_interval && (
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    ({subscription.billing_interval}ly)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-lg text-slate-400">No active subscription</p>
            )}
          </div>
          {tier && (
            <button
              onClick={handlePortal}
              className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Manage Billing
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>

        {subscription?.current_period_end && (
          <p className="text-xs text-slate-500">
            {subscription.status === "active" ? "Renews" : "Ends"}{" "}
            {new Date(subscription.current_period_end).toLocaleDateString()}
          </p>
        )}

        {subscription?.status === "past_due" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-red-400">
              Payment failed. Please update your payment method.
            </span>
          </div>
        )}
      </div>

      {/* Credit Balance Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Credit Balance</h2>
          </div>
          {(tier === "pro" || tier === "studio") && (
            <button
              onClick={handlePayg}
              className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              Buy Credits
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <p className={`text-3xl font-bold ${isLow ? "text-red-400" : "text-white"}`}>
          {balance.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-slate-400">
            / {allowance.toLocaleString()} monthly
          </span>
        </p>

        {/* Progress bar */}
        {allowance > 0 && (
          <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isLow ? "bg-red-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.max(0, 100 - usedPercent)}%` }}
            />
          </div>
        )}

        {isLow && (
          <p className="mt-2 text-xs text-red-400">
            Low balance! Consider purchasing additional credits.
          </p>
        )}
      </div>

      {/* Auto-Refill (Pro/Studio only) */}
      {(tier === "pro" || tier === "studio") && (
        <AutoRefillCard subscription={subscription} />
      )}

      {/* Usage Analytics */}
      <AnalyticsCard />

      {/* Usage History */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">Usage History</h2>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No usage yet.</p>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-800/50 transition-colors"
              >
                <div>
                  <p className="text-xs font-medium text-slate-200">
                    {SOURCE_LABELS[entry.source] || entry.source}
                  </p>
                  {entry.description && (
                    <p className="text-[10px] text-slate-500 truncate max-w-xs">
                      {entry.description}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={`text-xs font-mono ${
                      entry.amount > 0 ? "text-emerald-400" : "text-slate-300"
                    }`}
                  >
                    {entry.amount > 0 ? "+" : ""}
                    {entry.amount.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function AutoRefillCard({ subscription }: { subscription: Subscription | null }) {
  const [enabled, setEnabled] = useState(subscription?.auto_refill_enabled ?? false);
  const [threshold, setThreshold] = useState(subscription?.auto_refill_threshold ?? 100);
  const [credits, setCredits] = useState(subscription?.auto_refill_credits ?? 1000);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateAutoRefill(enabled, threshold, credits);
    } catch {
      alert("Failed to update auto-refill settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">Auto-Refill</h2>
        </div>
        <button
          onClick={() => { setEnabled(!enabled); }}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? "bg-amber-500" : "bg-slate-700"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Refill when balance drops below
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              min={10}
              step={10}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Credits to purchase
            </label>
            <select
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              <option value={1000}>1,000 credits</option>
              <option value={2000}>2,000 credits</option>
              <option value={5000}>5,000 credits</option>
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Auto-Refill Settings"}
          </button>
        </div>
      )}

      {!enabled && (
        <p className="text-xs text-slate-500">
          Automatically purchase credits when your balance runs low. Uses your saved payment method.
        </p>
      )}
    </div>
  );
}


function AnalyticsCard() {
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);

  useEffect(() => {
    getBillingAnalytics().then(setAnalytics).catch(() => {});
  }, []);

  if (!analytics) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-white">Usage Analytics</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg bg-slate-800/50 p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Daily Burn Rate</p>
          <p className="text-lg font-bold text-white">{analytics.burn_rate.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500">credits/day</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Days Remaining</p>
          <p className="text-lg font-bold text-white">
            {analytics.days_remaining !== null ? analytics.days_remaining : "--"}
          </p>
          <p className="text-[10px] text-slate-500">at current rate</p>
        </div>
      </div>

      {/* Cost breakdown by type */}
      {analytics.by_source.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-2">Credit Usage by Type</p>
          <div className="space-y-1.5">
            {analytics.by_source.map((item) => {
              const maxTotal = Math.max(...analytics.by_source.map((s) => s.total));
              const pct = maxTotal > 0 ? (item.total / maxTotal) * 100 : 0;
              return (
                <div key={item.source} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-24 truncate">
                    {SOURCE_LABELS[item.source] || item.source}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 w-12 text-right">
                    {item.total.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
