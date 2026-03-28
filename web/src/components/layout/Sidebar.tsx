"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Film,
  Settings,
  ScrollText,
  BookOpen,
  Palette,
  LayoutTemplate,
  ChevronDown,
  Plus,
  Globe,
  Scissors,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUniverseStore } from "@/stores/universe-store";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeUniverseId, universes, setActiveUniverse, fetchUniverses } =
    useUniverseStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUniverses();
  }, [fetchUniverses]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const activeUniverse = universes.find((u) => u.id === activeUniverseId);
  const studioPrefix = `/studio/${activeUniverseId}`;

  const studioNav = [
    { href: `${studioPrefix}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `${studioPrefix}/characters`, label: "Characters", icon: Users },
    { href: `${studioPrefix}/sources`, label: "Sources", icon: BookOpen },
    { href: `${studioPrefix}/environments`, label: "Environments", icon: Palette },
    { href: `${studioPrefix}/templates`, label: "Scene Templates", icon: LayoutTemplate },
    { href: `${studioPrefix}/generate`, label: "Generate", icon: Sparkles },
    { href: `${studioPrefix}/projects`, label: "Projects", icon: Film },
  ];

  const workshopNav = [
    { href: "/workshop/face-swap", label: "Face Swap", icon: ImageIcon },
    { href: "/workshop/style-transfer", label: "Style Transfer", icon: Scissors },
  ];

  function handleSwitchUniverse(id: string) {
    setActiveUniverse(id);
    setDropdownOpen(false);
    router.push(`/studio/${id}`);
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-800 bg-slate-900">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <ScrollText className="h-6 w-6 text-amber-500" />
        <Link href="/" className="text-lg font-semibold text-white tracking-tight hover:text-amber-400 transition-colors">
          LoreKit
        </Link>
      </div>

      {/* Universe Switcher */}
      <div className="px-3 mb-3" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-left hover:border-slate-600 transition-colors"
        >
          <span className="text-lg leading-none">{activeUniverse?.icon || "🌐"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {activeUniverse?.name || "Select Universe"}
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              {activeUniverse
                ? `${activeUniverse.character_count ?? 0} characters · ${activeUniverse.project_count ?? 0} projects`
                : "Loading..."}
            </p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", dropdownOpen && "rotate-180")} />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="mt-1 rounded-lg border border-slate-700 bg-slate-800 shadow-xl overflow-hidden z-50 relative">
            {universes.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSwitchUniverse(u.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  u.id === activeUniverseId
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                )}
              >
                <span className="text-base leading-none">{u.icon || "🌐"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {u.character_count ?? 0} chars · {u.project_count ?? 0} projects
                  </p>
                </div>
              </button>
            ))}
            <div className="border-t border-slate-700">
              <Link
                href="/universes/new"
                onClick={() => setDropdownOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Universe
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Studio Section */}
      <div className="px-3 mb-1">
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Studio
        </p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
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

        {/* Workshop Section */}
        <div className="pt-4 pb-1">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Workshop
          </p>
        </div>
        {workshopNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
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
              <span className="ml-auto text-[9px] text-slate-600 font-normal">Soon</span>
            </Link>
          );
        })}
      </nav>

      {/* Separator + Settings */}
      <div className="border-t border-slate-800 px-3 py-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-amber-500/10 text-amber-500"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
