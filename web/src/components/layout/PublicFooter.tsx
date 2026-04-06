import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";

const PRODUCT_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/product#text-to-video", label: "Text-to-Video" },
  { href: "/product#script-to-video", label: "Script-to-Video" },
  { href: "/product#carousel-generator", label: "Carousel Generator" },
];

const SOLUTIONS_LINKS = [
  { href: "/agencies", label: "For Agencies" },
  { href: "/product#brand-storytelling", label: "Brand Storytelling" },
  { href: "/product#ad-creation", label: "Ad Creation" },
  { href: "/product#short-form-content", label: "Short-Form Content" },
  { href: "/enterprise", label: "Enterprise" },
];

const RESOURCE_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/docs/getting-started", label: "Getting Started" },
  { href: "/docs/self-hosting", label: "Self-Hosting" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800/50 py-10 sm:py-14 px-4 sm:px-6 starfield">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Logo size="sm" />
            <p className="mt-3 text-xs text-slate-500 leading-relaxed max-w-[200px]">
              Open-source AI video creation studio. MIT licensed.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-slate-500 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Solutions</h4>
            <ul className="space-y-2">
              {SOLUTIONS_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-slate-500 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Resources</h4>
            <ul className="space-y-2">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-slate-500 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Community</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/lorekit/lorekit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                >
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </footer>
  );
}
