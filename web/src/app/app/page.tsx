"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe,
  Film,
  Sparkles,
  Terminal,
  BookOpen,
  Settings,
  Wallet,
  TrendingDown,
} from "lucide-react";
import { getStats } from "@/lib/api";
import type { Stats } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TOTAL_TOOLS } from "@/lib/mcp-tools";

const GUIDE_KEY = "lorekit_hide_getting_started";

export default function AppHomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const hidden = localStorage.getItem(GUIDE_KEY) === "1";
    setShowGuide(!hidden);
  }, []);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function hideGuide() {
    setShowGuide(false);
    localStorage.setItem(GUIDE_KEY, "1");
  }

  function toggleGuide() {
    const next = !showGuide;
    setShowGuide(next);
    if (!next) {
      localStorage.setItem(GUIDE_KEY, "1");
    } else {
      localStorage.removeItem(GUIDE_KEY);
    }
  }

  // Credit balance and spend — placeholder until billing (Phase 5) is built
  const creditBalance = 0;
  const creditSpent7d = stats?.videos?.total_cost ?? 0;

  return (
    <div className="p-8 space-y-8">

      {/* Header with guide toggle */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Start exploring LoreKit&apos;s capabilities
          <span className="mx-1.5 text-slate-600">&middot;</span>
          <button
            onClick={toggleGuide}
            className="text-amber-400 hover:text-amber-300 underline decoration-dotted underline-offset-2 transition-colors"
          >
            {showGuide ? "Hide getting started guide" : "Getting started guide"}
          </button>
        </p>
      </div>

      {/* Getting Started Guide — dismissible */}
      {showGuide && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Getting started</h2>
            <button
              onClick={hideGuide}
              className="text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
            >
              Don&apos;t show this
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Connect Claude card */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white">Getting started with MCP</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Start building with Claude in minutes.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Terminal, label: "Connect Claude Code", href: "/docs/getting-started", newTab: true },
                  { icon: BookOpen, label: "Go to documentation", href: "/docs", newTab: true },
                  { icon: Settings, label: "Configure API keys", href: "/app/settings" },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex items-center gap-3 text-sm text-slate-300 hover:text-white transition-colors py-1"
                  >
                    <item.icon className="h-4 w-4 text-slate-500" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Explore the app card */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white">Explore LoreKit</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Create universes, characters, and videos.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Globe, label: "Create a universe", href: "/app/universes/new" },
                  { icon: Film, label: "Browse your projects", href: "/app/projects" },
                  { icon: Sparkles, label: `${TOTAL_TOOLS} MCP tools available`, href: "/docs/mcp-tools", newTab: true },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex items-center gap-3 text-sm text-slate-300 hover:text-white transition-colors py-1"
                  >
                    <item.icon className="h-4 w-4 text-slate-500" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Credit Balance</p>
              <p
                className={cn(
                  "text-2xl font-bold mt-1",
                  loading ? "text-slate-500 animate-pulse" : "text-white"
                )}
              >
                {loading ? "\u2014" : creditBalance.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">credits</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </div>
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Credits Spent (last 7 days)</p>
              <p
                className={cn(
                  "text-2xl font-bold mt-1",
                  loading ? "text-slate-500 animate-pulse" : "text-white"
                )}
              >
                {loading ? "\u2014" : `$${creditSpent7d.toFixed(2)}`}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
