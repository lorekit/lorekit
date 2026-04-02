import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";

export function PublicHeader() {
  return (
    <header className="border-b border-slate-800/50 relative z-20 starfield">
      <div className="max-w-6xl mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 py-2 sm:py-3">
        <Link href="/">
          <Logo size="xs" className="sm:hidden" />
          <Logo size="sm" className="hidden sm:inline-flex" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/docs"
            className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors"
          >
            Docs
          </Link>
          <a
            href="https://github.com/anthropics/lorekit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link
            href="/app"
            className="btn-shimmer rounded-full px-3 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm font-medium text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
