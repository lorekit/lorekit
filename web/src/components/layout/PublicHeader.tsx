"use client";

import Link from "next/link";
import { Menu, X, ChevronDown, ArrowRight, Code, Video, Brush, Megaphone, Star } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useState, useRef, useEffect, useCallback } from "react";

const PRODUCT_FEATURES = [
  { href: "/product#text-to-video", label: "Text-to-Video" },
  { href: "/product#text-to-image", label: "Text-to-Image" },
  { href: "/product#image-to-video", label: "Image-to-Video" },
  { href: "/product#script-to-video", label: "Script-to-Video" },
  { href: "/product#video-to-video", label: "Video-to-Video" },
  { href: "/product#script-generator", label: "Script Generator" },
  { href: "/product#carousel-generator", label: "Carousel Generator" },
];

const SOLUTIONS_USE_CASES = [
  { href: "/product#brand-storytelling", label: "Brand Storytelling" },
  { href: "/product#ad-creation", label: "Ad Creation" },
  { href: "/product#short-form-content", label: "Short-Form Content" },
  { href: "/product#social-media-content", label: "Social Media" },
];

const SOLUTIONS_INDUSTRIES = [
  {
    href: "/marketing-teams",
    label: "Marketing Teams",
    icon: Video,
    gradient: "from-amber-500/20 via-orange-500/10 to-amber-500/5",
  },
  {
    href: "/brand-studios",
    label: "Brand Studios",
    icon: Brush,
    gradient: "from-cyan-500/20 via-blue-500/10 to-cyan-500/5",
  },
  {
    href: "/agencies",
    label: "Advertising Agencies",
    icon: Megaphone,
    gradient: "from-purple-500/20 via-violet-500/10 to-purple-500/5",
  },
];

const NAV_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
];

type DropdownName = "product" | "solutions" | null;

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownName>(null);
  const [mobileProductOpen, setMobileProductOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch GitHub star count
  useEffect(() => {
    const cached = sessionStorage.getItem("gh-stars");
    if (cached) {
      setStarCount(Number(cached));
      return;
    }
    fetch("https://api.github.com/repos/lorekit/lorekit")
      .then((r) => r.json())
      .then((data) => {
        if (data.stargazers_count != null) {
          setStarCount(data.stargazers_count);
          sessionStorage.setItem("gh-stars", String(data.stargazers_count));
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleEnter = useCallback((name: DropdownName) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenDropdown(name);
  }, []);

  const handleLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpenDropdown(null), 150);
  }, []);

  const closeAll = () => {
    setOpenDropdown(null);
    setMenuOpen(false);
  };

  return (
    <header ref={headerRef} className="border-b border-slate-800/50 relative z-20 starfield">
      <div className="max-w-7xl mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 py-2 sm:py-3">
        <Link href="/">
          <Logo size="xs" className="sm:hidden" />
          <Logo size="sm" className="hidden sm:inline-flex" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          {/* Product dropdown trigger */}
          <div
            onMouseEnter={() => handleEnter("product")}
            onMouseLeave={handleLeave}
          >
            <button
              onClick={() => setOpenDropdown(openDropdown === "product" ? null : "product")}
              className={`text-sm transition-colors flex items-center gap-1 ${openDropdown === "product" ? "text-white" : "text-slate-400 hover:text-white"}`}
            >
              Product
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDropdown === "product" ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Solutions dropdown trigger */}
          <div
            onMouseEnter={() => handleEnter("solutions")}
            onMouseLeave={handleLeave}
          >
            <button
              onClick={() => setOpenDropdown(openDropdown === "solutions" ? null : "solutions")}
              className={`text-sm transition-colors flex items-center gap-1 ${openDropdown === "solutions" ? "text-white" : "text-slate-400 hover:text-white"}`}
            >
              Solutions
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDropdown === "solutions" ? "rotate-180" : ""}`} />
            </button>
          </div>

          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://www.aivideofunnel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-shimmer rounded-full px-4 py-1.5 text-sm font-medium text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
          >
            Free UGC Library
          </a>
          <a
            href="https://github.com/lorekit/lorekit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-slate-700 hover:border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <Star className="h-3.5 w-3.5" />
            {starCount != null ? starCount.toLocaleString() : "Star"}
          </a>
        </div>

        {/* Mobile: Get Started + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <a
            href="https://www.aivideofunnel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-shimmer rounded-full px-3 py-1 text-xs font-medium text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
          >
            Free UGC Library
          </a>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ─── Desktop: Product mega-menu ─── */}
      {openDropdown === "product" && (
        <div
          className="hidden md:block absolute left-0 right-0 top-full border-t border-slate-800/50 bg-slate-900/98 backdrop-blur-xl shadow-2xl shadow-black/40 z-30"
          onMouseEnter={() => handleEnter("product")}
          onMouseLeave={handleLeave}
        >
          <div className="max-w-7xl mx-auto px-6 py-6 flex gap-10">
            {/* Features - two columns */}
            <div className="flex gap-10">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Features</span>
                <div className="mt-3 w-[200px]">
                  {PRODUCT_FEATURES.slice(0, 4).map((f) => (
                    <Link key={f.href} href={f.href} onClick={closeAll} className="block py-2.5 text-sm text-slate-300 hover:text-white transition-colors border-b border-slate-800/60 last:border-b-0">
                      {f.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="h-[18px]" />
                <div className="mt-3 w-[200px]">
                  {PRODUCT_FEATURES.slice(4).map((f) => (
                    <Link key={f.href} href={f.href} onClick={closeAll} className="block py-2.5 text-sm text-slate-300 hover:text-white transition-colors border-b border-slate-800/60 last:border-b-0">
                      {f.label}
                    </Link>
                  ))}
                  <Link href="/product" onClick={closeAll} className="inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-white hover:text-amber-400 transition-colors">
                    See All <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: featured card */}
            <div className="flex-1">
              <a href="https://github.com/lorekit/lorekit" target="_blank" rel="noopener noreferrer" onClick={closeAll} className="group flex flex-col justify-between h-full rounded-xl overflow-hidden bg-gradient-to-br from-amber-500/15 via-cyan-500/10 to-purple-500/15 border border-slate-800 hover:border-slate-700 transition-colors p-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="h-5 w-5 text-amber-400" />
                    <span className="text-base font-semibold text-white">Open Source</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                    MIT licensed. Self-host it, bring your own API keys, own your data. The only open-source AI video studio.
                  </p>
                </div>
                <div className="flex items-center justify-end mt-4">
                  <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-white transition-colors" />
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── Desktop: Solutions mega-menu ─── */}
      {openDropdown === "solutions" && (
        <div
          className="hidden md:block absolute left-0 right-0 top-full border-t border-slate-800/50 bg-slate-900/98 backdrop-blur-xl shadow-2xl shadow-black/40 z-30"
          onMouseEnter={() => handleEnter("solutions")}
          onMouseLeave={handleLeave}
        >
          <div className="max-w-7xl mx-auto px-6 py-6 flex gap-10">
            {/* By Use Case column */}
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">By Use Case</span>
              <div className="mt-3 w-[200px]">
                {SOLUTIONS_USE_CASES.map((item) => (
                  <Link key={item.href} href={item.href} onClick={closeAll} className="block py-2.5 text-sm text-slate-300 hover:text-white transition-colors border-b border-slate-800/60 last:border-b-0">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* By Industry - image cards */}
            <div className="flex-1">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">By Industry</span>
              <div className="mt-3 grid grid-cols-3 gap-4">
                {SOLUTIONS_INDUSTRIES.map((ind) => (
                  <Link
                    key={ind.label}
                    href={ind.href}
                    onClick={closeAll}
                    className="group rounded-xl overflow-hidden border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    {/* Image placeholder */}
                    <div className={`h-28 bg-gradient-to-br ${ind.gradient} bg-slate-800/50 flex items-center justify-center`}>
                      <ind.icon className="h-8 w-8 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Label */}
                    <div className="px-3 py-3 flex items-center justify-between">
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{ind.label}</span>
                      <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Mobile menu ─── */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-800/50 bg-slate-900/98 backdrop-blur-xl shadow-2xl shadow-black/40">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {/* Product section */}
            <button
              onClick={() => setMobileProductOpen(!mobileProductOpen)}
              className="text-sm text-slate-400 hover:text-white transition-colors py-2 px-2 rounded-lg hover:bg-slate-800/50 flex items-center justify-between w-full text-left"
            >
              Product
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileProductOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileProductOpen && (
              <div className="ml-3 flex flex-col gap-0.5">
                {PRODUCT_FEATURES.map((f) => (
                  <Link key={f.href} href={f.href} onClick={closeAll} className="text-sm text-slate-500 hover:text-white transition-colors py-1.5 px-2 rounded-lg hover:bg-slate-800/50">
                    {f.label}
                  </Link>
                ))}
                <Link href="/product" onClick={closeAll} className="text-sm font-medium text-white hover:bg-slate-800/50 transition-colors py-1.5 px-2 rounded-lg flex items-center gap-1">
                  See All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Solutions section */}
            <button
              onClick={() => setMobileSolutionsOpen(!mobileSolutionsOpen)}
              className="text-sm text-slate-400 hover:text-white transition-colors py-2 px-2 rounded-lg hover:bg-slate-800/50 flex items-center justify-between w-full text-left"
            >
              Solutions
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileSolutionsOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileSolutionsOpen && (
              <div className="ml-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 pt-1">Use Cases</span>
                {SOLUTIONS_USE_CASES.map((item) => (
                  <Link key={item.href} href={item.href} onClick={closeAll} className="text-sm text-slate-500 hover:text-white transition-colors py-1.5 px-2 rounded-lg hover:bg-slate-800/50">
                    {item.label}
                  </Link>
                ))}
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 pt-2">Industry</span>
                {SOLUTIONS_INDUSTRIES.map((ind) => (
                  <Link key={ind.label} href={ind.href} onClick={closeAll} className="text-sm text-slate-500 hover:text-white transition-colors py-1.5 px-2 rounded-lg hover:bg-slate-800/50">
                    {ind.label}
                  </Link>
                ))}
              </div>
            )}

            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={closeAll} className="text-sm text-slate-400 hover:text-white transition-colors py-2 px-2 rounded-lg hover:bg-slate-800/50">
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/lorekit/lorekit"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeAll}
              className="text-sm text-slate-400 hover:text-white transition-colors py-2 px-2 rounded-lg hover:bg-slate-800/50 flex items-center gap-1.5"
            >
              <Star className="h-3.5 w-3.5" />
              Star on GitHub
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
