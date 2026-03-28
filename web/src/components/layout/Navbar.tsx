"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Universe" },
  { href: "/video", label: "Video" },
  { href: "/carousel", label: "Carousel" },
  { href: "/image", label: "Image" },
];

export function Navbar() {
  const pathname = usePathname();

  // Hide navbar when inside a studio universe (sidebar takes over)
  const inStudio = pathname.startsWith("/studio/");
  if (inStudio) return null;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-amber-500" />
        <span className="text-base font-semibold text-white tracking-tight">
          LoreKit
        </span>
      </Link>

      {/* Nav pills */}
      <nav className="flex items-center gap-1.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/universes")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Settings icon */}
        <Link
          href="/settings"
          className={cn(
            "ml-2 flex h-8 w-8 items-center justify-center rounded-full transition-colors",
            pathname === "/settings"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Settings className="h-4 w-4" />
        </Link>
      </nav>
    </header>
  );
}
