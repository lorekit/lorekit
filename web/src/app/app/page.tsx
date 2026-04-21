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
} from "lucide-react";
import { TOTAL_TOOLS } from "@/lib/mcp-tools";

const GUIDE_KEY = "lorekit_hide_getting_started";

export default function AppHomePage() {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const hidden = localStorage.getItem(GUIDE_KEY) === "1";
    setShowGuide(!hidden);
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

  const [roadmapItems, setRoadmapItems] = useState<string[]>([]);

  useEffect(() => {
    fetch("/roadmap.json")
      .then((r) => r.json())
      .then(setRoadmapItems)
      .catch(() => {});
  }, []);

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
                  { icon: Terminal, label: "Connect Claude Code", href: "https://lorekit.ai/docs/getting-started", newTab: true },
                  { icon: BookOpen, label: "Go to documentation", href: "https://lorekit.ai/docs", newTab: true },
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
                  { icon: Sparkles, label: `${TOTAL_TOOLS} MCP tools available`, href: "https://lorekit.ai/docs/mcp-tools", newTab: true },
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

      {/* Roadmap */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Roadmap</h2>
        <div className="space-y-2">
          {roadmapItems.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-amber-500 mt-0.5">&#8226;</span>
              <span className="text-sm text-slate-300">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
