"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Rocket, Terminal, Boxes, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

const DOC_NAV = [
  {
    label: "Getting Started",
    items: [
      { href: "/docs", label: "Overview", icon: BookOpen },
      { href: "/docs/getting-started", label: "Setup Guide", icon: Rocket },
    ],
  },
  {
    label: "Reference",
    items: [
      { href: "/docs/mcp-tools", label: "MCP Tools", icon: Terminal },
      { href: "/docs/nodes", label: "Workflow Nodes", icon: Boxes },
    ],
  },
  {
    label: "Deploy",
    items: [
      { href: "/docs/self-hosting", label: "Self-Hosting", icon: Server },
    ],
  },
];

function SidebarLink({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: React.ElementType; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
        active
          ? "text-amber-400 bg-amber-500/10 font-medium"
          : "text-slate-400 hover:text-white hover:bg-slate-800/50"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <PublicHeader />

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 border-r border-slate-800/50 sticky top-0 h-screen overflow-y-auto py-8 px-4 hidden md:block">
          <nav className="space-y-6">
            {DOC_NAV.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={pathname === item.href}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile nav */}
        <nav className="md:hidden border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10 w-full">
          <div className="flex gap-1 overflow-x-auto px-4 py-2">
            {DOC_NAV.flatMap((g) => g.items).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors",
                  pathname === item.href
                    ? "text-amber-400 bg-amber-500/10 font-medium"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0 py-8 px-6 lg:px-12">
          <div className="max-w-3xl">
            {children}
          </div>
        </main>
      </div>

      <PublicFooter />
    </div>
  );
}
