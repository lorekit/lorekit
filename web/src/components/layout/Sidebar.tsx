"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Film,
  Palette,
  ScrollText,
  FolderOpen,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUniverseStore } from "@/stores/universe-store";
import { getVibePresets, updateUniverse } from "@/lib/api";
import type { VibePreset } from "@/lib/api";

export function Sidebar() {
  const pathname = usePathname();
  const { activeUniverseId, universes, fetchUniverses } = useUniverseStore();
  const [vibePresets, setVibePresets] = useState<Record<string, VibePreset>>({});

  useEffect(() => {
    getVibePresets()
      .then((data) => setVibePresets(data.presets))
      .catch(() => {});
  }, []);

  // Hide sidebar entirely on project editor pages (full-screen editor)
  const isProjectEditor =
    /^\/app\/universe\/[^/]+\/projects\/[^/]+$/.test(pathname) &&
    !pathname.endsWith("/generate");
  if (isProjectEditor) return null;

  const activeUniverse = universes.find((u) => u.id === activeUniverseId);
  const studioPrefix = `/app/universe/${activeUniverseId}`;

  const handleVibeChange = async (presetKey: string) => {
    if (!activeUniverse) return;
    try {
      await updateUniverse(activeUniverseId, { video_vibe_preset: presetKey });
      await fetchUniverses();
    } catch {}
  };

  const studioNav = [
    { href: studioPrefix, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `${studioPrefix}/projects`, label: "Projects", icon: Film },
    { href: `${studioPrefix}/characters`, label: "Characters", icon: Users },
    { href: `${studioPrefix}/scripts`, label: "Scripts", icon: ScrollText },
    { href: `${studioPrefix}/environments`, label: "Environments", icon: Palette },
    { href: `${studioPrefix}/assets`, label: "Assets", icon: FolderOpen },
  ];

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-800 bg-slate-900">
      {/* Back to universes */}
      <Link
        href="/app/universe"
        className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Universe
      </Link>

      {/* Universe name + vibe */}
      <div className="px-4 py-4 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">{activeUniverse?.icon || "🌐"}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {activeUniverse?.name || "Universe"}
            </p>
          </div>
        </div>
        {Object.keys(vibePresets).length > 0 && (
          <select
            value={activeUniverse?.video_vibe_preset ?? "mobile_game"}
            onChange={(e) => handleVibeChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-colors cursor-pointer"
          >
            {Object.entries(vibePresets)
              .filter(([k]) => k !== "custom")
              .sort(([, a], [, b]) => a.name.localeCompare(b.name))
              .map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Studio nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {studioNav.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && (item.href !== studioPrefix || pathname === studioPrefix);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-amber-500/10 text-amber-500"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>


    </aside>
  );
}
