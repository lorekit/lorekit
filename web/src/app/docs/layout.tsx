import Link from "next/link";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export const metadata: Metadata = {
  title: "LoreKit Docs — AI Video Generation Platform",
  description:
    "Documentation for LoreKit: MCP tools, API reference, self-hosting guide, and getting started.",
};

const DOC_NAV = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/getting-started", label: "Getting Started" },
  { href: "/docs/mcp-tools", label: "MCP Tools" },
  { href: "/docs/nodes", label: "Workflow Nodes" },
  { href: "/docs/self-hosting", label: "Self-Hosting" },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Docs sub-nav */}
      <nav className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {DOC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-3 text-sm text-slate-400 hover:text-white transition-colors whitespace-nowrap border-b-2 border-transparent hover:border-amber-500/50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <PublicFooter />
    </div>
  );
}
