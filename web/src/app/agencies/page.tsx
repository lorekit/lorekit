import Link from "next/link";
import { Globe, Target, Palette, ArrowRight, Sparkles, Users, Layers, Repeat } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

const VALUE_PROPS = [
  {
    icon: Globe,
    title: "Any Niche",
    description:
      "Dental, med spas, e-commerce, real estate, fitness, restaurants. One tool for every client. Set up a brand universe per client and generate on-brand content for each.",
    iconColor: "text-amber-400",
    glow: "rgba(245,158,11,0.15)",
  },
  {
    icon: Target,
    title: "Hook Testing",
    description:
      "Generate multiple hook variants for the same ad. Different opening lines, different visuals, same core message. Render each variant and A/B test what converts.",
    iconColor: "text-cyan-400",
    glow: "rgba(34,211,238,0.12)",
  },
  {
    icon: Palette,
    title: "Brand Consistency",
    description:
      "One universe per client keeps everything on-brand. Characters, visual styles, color grading, and voice all stay consistent across every video you produce.",
    iconColor: "text-purple-400",
    glow: "rgba(168,85,247,0.12)",
  },
];

const WORKFLOW_STEPS = [
  {
    icon: Users,
    title: "Set up the client universe",
    description: "Add their brand assets, spokesperson, visual style, and source content. This is done once and reused for every video.",
  },
  {
    icon: Layers,
    title: "Script from their brief",
    description: "Choose an ad structure or story arc. Write the script yourself or let AI break it down scene by scene from the client's brief.",
  },
  {
    icon: Target,
    title: "Generate variants",
    description: "Create 2-3 hook variants for the same ad. AI generates keyframes, video clips, voiceover, and music for each.",
  },
  {
    icon: Repeat,
    title: "Deliver renders",
    description: "Render each variant as a finished video. Hand off to the client or deploy directly to their ad platform. Iterate fast.",
  },
];

export default function AgenciesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 text-center starfield">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs text-amber-400 font-medium mb-6">
            For Agencies
          </div>
          <h1 className="text-3xl sm:text-5xl font-logo font-bold text-white tracking-wide leading-tight">
            AI video production{" "}
            <span className="text-amber-400" style={{ textShadow: "0 0 20px rgba(251,191,36,0.3)" }}>
              for your clients.
            </span>
            {" "}At scale.
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            White-label video creation across any niche. Generate on-brand content, test hooks, ship what works. Your clients see results, not the tool.
          </p>
          <div className="mt-8 sm:mt-10 flex items-center gap-4 justify-center">
            <Link
              href="/app"
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
            Why agencies use LoreKit
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

      {/* Agency workflow */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white text-center mb-10 sm:mb-16 tracking-wide">
            How it works for agencies
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
            Scale without scaling headcount
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto mb-10">
            Traditional video production for one client takes days and a team. With LoreKit, one person can manage multiple client universes, generate ad variants in minutes, and deliver renders the same day. Your margins improve with every client you add.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-amber-400 mb-1">Minutes</div>
              <div className="text-xs text-slate-500">From brief to first render</div>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-cyan-400 mb-1">Unlimited</div>
              <div className="text-xs text-slate-500">Hook variants per ad</div>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-purple-400 mb-1">Any niche</div>
              <div className="text-xs text-slate-500">One tool, every client</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-4 tracking-wide">
            Start producing for your clients
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-lg">
            Set up your first client universe and generate a video today. Free, open source, and ready to go.
          </p>
          <Link
            href="/app"
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
