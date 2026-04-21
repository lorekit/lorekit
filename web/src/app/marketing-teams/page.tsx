import Link from "next/link";
import { Target, Zap, BarChart3, ArrowRight, Sparkles, Layers, Repeat, Users, Rocket } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { getCtaHref } from "@/lib/mode";
import { PublicFooter } from "@/components/layout/PublicFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Ads for Marketing Teams | LoreKit",
  description:
    "Scale your marketing team's video ad output with AI. Generate on-brand video ads from script to screen — hook variants, A/B tests, and cross-channel content in minutes.",
  openGraph: {
    title: "AI Video Ads for Marketing Teams | LoreKit",
    description:
      "Scale your marketing team's video ad output with AI. Generate on-brand video ads from script to screen.",
  },
};

const VALUE_PROPS = [
  {
    icon: Zap,
    title: "Campaign Velocity",
    description:
      "Go from brief to finished video ads in minutes, not days. Generate 10-100+ ad variants per week without adding headcount. Launch campaigns faster and iterate on what works.",
    iconColor: "text-amber-400",
    glow: "rgba(245,158,11,0.15)",
  },
  {
    icon: Target,
    title: "Cross-Channel Consistency",
    description:
      "One brand universe powers every channel. Same characters, voice, and visual style across Meta, TikTok, YouTube, and email. Update once, apply everywhere.",
    iconColor: "text-cyan-400",
    glow: "rgba(34,211,238,0.12)",
  },
  {
    icon: BarChart3,
    title: "Data-Driven Iteration",
    description:
      "Generate multiple hook variants for every ad. Test different openings, angles, and CTAs. Double down on winners and cut losers — all without reshooting.",
    iconColor: "text-purple-400",
    glow: "rgba(168,85,247,0.12)",
  },
];

const WORKFLOW_STEPS = [
  {
    icon: Users,
    title: "Set up your brand universe",
    description: "Add your brand assets, spokesperson, visual style, and messaging guidelines. Done once — every video stays on-brand automatically.",
  },
  {
    icon: Layers,
    title: "Create a campaign brief",
    description: "Choose an ad structure or story arc. Write the script or paste your brief and let AI break it down scene by scene.",
  },
  {
    icon: Rocket,
    title: "Generate ad variants",
    description: "AI produces keyframes, video clips, voiceover, and music for each variant. Create multiple hooks, angles, and CTAs from one brief.",
  },
  {
    icon: Repeat,
    title: "Deploy and iterate",
    description: "Render finished videos and push to your ad platforms. See what converts, then generate more variants of your winners.",
  },
];

export default function MarketingTeamsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 text-center starfield">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs text-amber-400 font-medium mb-6">
            For Marketing Teams
          </div>
          <h1 className="text-3xl sm:text-5xl font-logo font-bold text-white tracking-wide leading-tight">
            Scale your ad output{" "}
            <span className="text-amber-400" style={{ textShadow: "0 0 20px rgba(251,191,36,0.3)" }}>
              without scaling your team.
            </span>
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            AI video ads from brief to screen. Generate on-brand content, test hooks across channels, and ship what converts — all from one platform.
          </p>
          <div className="mt-8 sm:mt-10 flex items-center gap-4 justify-center">
            <Link
              href={getCtaHref()}
              className="btn-shimmer rounded-full px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-slate-950 flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              <Sparkles className="h-4 w-4" />
              Start Building
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white text-center mb-10 sm:mb-16 tracking-wide">
            Why marketing teams use LoreKit
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {VALUE_PROPS.map((prop) => (
              <div key={prop.title} className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
                <div
                  className="h-11 w-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4"
                  style={{ boxShadow: `0 0 20px ${prop.glow}` }}
                >
                  <prop.icon className={`h-5 w-5 ${prop.iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{prop.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white text-center mb-10 sm:mb-16 tracking-wide">
            How it works for marketing teams
          </h2>
          <div className="space-y-6">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-4">
                <div className="shrink-0 h-9 w-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-400">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The math */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-6 tracking-wide">
            More ads, same team
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto mb-10">
            Traditional video production means coordinating shoots, editors, and revisions for every campaign. With LoreKit, your marketing team generates ad variants in minutes, tests across channels, and iterates on winners without waiting on external resources.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-amber-400 mb-1">10-100+</div>
              <div className="text-xs text-slate-500">Ad variants per week</div>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-cyan-400 mb-1">Minutes</div>
              <div className="text-xs text-slate-500">From brief to finished video</div>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-purple-400 mb-1">Every channel</div>
              <div className="text-xs text-slate-500">Meta, TikTok, YouTube, email</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-4 tracking-wide">
            Start scaling your ad output
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-lg">
            Set up your brand universe and generate your first video ad today. Free, open source, and ready to go.
          </p>
          <Link
            href={getCtaHref()}
            className="btn-shimmer inline-flex items-center gap-2 rounded-full px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            <Sparkles className="h-4 w-4" />
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
