import Link from "next/link";
import { Palette, Layers, Brush, ArrowRight, Sparkles, Users, Repeat, Eye, Rocket } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { getCtaHref } from "@/lib/mode";
import { PublicFooter } from "@/components/layout/PublicFooter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Production for Brand Studios | LoreKit",
  description:
    "Produce on-brand video content at scale. Manage multiple brands, maintain creative control, and deliver polished video ads from one AI-powered studio platform.",
  openGraph: {
    title: "AI Video Production for Brand Studios | LoreKit",
    description:
      "Produce on-brand video content at scale. Manage multiple brands, maintain creative control, and deliver polished video ads.",
  },
};

const VALUE_PROPS = [
  {
    icon: Palette,
    title: "Creative Control",
    description:
      "Direct every detail — characters, visual style, color grading, camera moves, and voice. AI handles production, you keep creative ownership. Refine scene by scene until it's right.",
    iconColor: "text-cyan-400",
    glow: "rgba(34,211,238,0.15)",
  },
  {
    icon: Layers,
    title: "Multi-Brand Management",
    description:
      "One universe per brand keeps every client's identity separate and consistent. Switch between brands instantly. Characters, styles, and assets never bleed across projects.",
    iconColor: "text-amber-400",
    glow: "rgba(245,158,11,0.12)",
  },
  {
    icon: Rocket,
    title: "Production Speed",
    description:
      "Go from creative brief to rendered video in minutes. No shoots, no editors, no revision cycles. Generate variants, pick winners, and deliver finals the same day.",
    iconColor: "text-purple-400",
    glow: "rgba(168,85,247,0.12)",
  },
];

const WORKFLOW_STEPS = [
  {
    icon: Users,
    title: "Build a universe per brand",
    description: "Create a brand universe with characters, visual identity, color palette, and tone of voice. Every video generated from this universe stays on-brand.",
  },
  {
    icon: Eye,
    title: "Set the creative direction",
    description: "Choose an arc template or ad structure. Define the visual style, pacing, and mood. Write the script or let AI generate one from your brief.",
  },
  {
    icon: Brush,
    title: "Generate and refine",
    description: "AI produces keyframes, video clips, voiceover, and music. Review each scene, adjust prompts, regenerate what needs work. Full creative control at every step.",
  },
  {
    icon: Repeat,
    title: "Deliver polished finals",
    description: "Render finished videos with transitions, audio mixing, and color grading. Export multiple variants for different platforms and aspect ratios.",
  },
];

export default function BrandStudiosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 text-center starfield">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 text-xs text-cyan-400 font-medium mb-6">
            For Brand Studios
          </div>
          <h1 className="text-3xl sm:text-5xl font-logo font-bold text-white tracking-wide leading-tight">
            AI-powered production{" "}
            <span className="text-cyan-400" style={{ textShadow: "0 0 20px rgba(34,211,238,0.3)" }}>
              for your brands.
            </span>
            {" "}At scale.
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            Produce polished video content across every brand you manage. Full creative control, consistent identity, and delivery in minutes — not weeks.
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
            Why brand studios use LoreKit
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
            How it works for brand studios
          </h2>
          <div className="space-y-6">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-4">
                <div className="shrink-0 h-9 w-9 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-sm font-bold text-cyan-400">
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
            Studio-grade output, fraction of the time
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto mb-10">
            Traditional branded video production means coordinating talent, shoots, and post-production across every client. With LoreKit, your studio produces polished video content from a single platform — one universe per brand, consistent quality, delivered in minutes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-cyan-400 mb-1">Minutes</div>
              <div className="text-xs text-slate-500">From brief to polished video</div>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-amber-400 mb-1">Unlimited</div>
              <div className="text-xs text-slate-500">Brands and universes</div>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-2xl font-bold text-purple-400 mb-1">Full control</div>
              <div className="text-xs text-slate-500">Every scene, every detail</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-4 tracking-wide">
            Start producing for your brands
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-lg">
            Set up your first brand universe and generate a video today. Free, open source, and ready to go.
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
