"use client";

import Link from "next/link";
import { Check, ArrowRight, Sparkles, Zap, Server, Shield, Headphones, Code, Database } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

/* ── Pro slider options ── */
const PRO_OPTIONS = [
  { credits: 4_000, monthly: 79, annual: 67, clips: 72 },
  { credits: 5_500, monthly: 109, annual: 93, clips: 100 },
  { credits: 7_000, monthly: 139, annual: 118, clips: 127 },
  { credits: 8_000, monthly: 159, annual: 135, clips: 145 },
];

/* ── Studio slider options ── */
const STUDIO_OPTIONS = [
  { credits: 10_000, monthly: 199, annual: 169, clips: 181 },
  { credits: 15_000, monthly: 289, annual: 246, clips: 272 },
  { credits: 20_000, monthly: 379, annual: 322, clips: 363 },
  { credits: 25_000, monthly: 459, annual: 390, clips: 454 },
];

/* ── Compare Plans table rows ── */
const COMPARE_ROWS = [
  {
    category: "Video",
    items: [
      { label: "Kling V3 Pro (5s)", sub: "55 credits/clip", creator: "~27 clips", pro: "~72 clips", studio: "~181 clips" },
      { label: "Kling O3 (5s)", sub: "42 credits/clip", creator: "~35 clips", pro: "~95 clips", studio: "~238 clips" },
    ],
  },
  {
    category: "Image",
    items: [
      { label: "Keyframe (Flux Pro)", sub: "3 credits/image", creator: "~500 images", pro: "~1,333 images", studio: "~3,333 images" },
    ],
  },
  {
    category: "Script & Audio",
    items: [
      { label: "Script Generation", sub: "5 credits/script", creator: "~300 scripts", pro: "~800 scripts", studio: "~2,000 scripts" },
      { label: "TTS Narration", sub: "6 credits/1k chars", creator: "~250 narrations", pro: "~666 narrations", studio: "~1,666 narrations" },
    ],
  },
  {
    category: "Platform",
    items: [
      { label: "Concurrent Jobs", sub: "", creator: "1", pro: "3", studio: "6" },
      { label: "Pay-as-you-go", sub: "", creator: "No", pro: "$20/1,000 credits", studio: "$18/1,000 credits" },
      { label: "Support", sub: "", creator: "Community", pro: "Email", studio: "Slack + Priority" },
    ],
  },
];

const FAQS = [
  {
    q: "What are credits?",
    a: "Credits are the currency for AI generation on LoreKit Cloud. Each action (generating a video clip, creating a keyframe, running text-to-speech) costs a set number of credits. Your monthly plan includes a credit allowance that refills each billing cycle.",
  },
  {
    q: "What can I do with my credits?",
    a: "A typical 30-second video with 6 scenes uses about 333 credits. That breaks down to ~55 credits per Kling V3 Pro clip, ~3 credits per keyframe image, ~6 credits per 1,000 characters of narration, ~5 credits for script generation, and ~1 credit for final render.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "Pro and Studio subscribers can purchase additional credit packs on demand. Creator plan users can upgrade to Pro to unlock pay-as-you-go credit purchases. Unused credits do not roll over to the next month.",
  },
  {
    q: "Is there a free tier?",
    a: "LoreKit is open source and MIT licensed. You can self-host it for free with your own API keys and have no limits at all. Cloud plans are for teams that want managed infrastructure without any setup.",
  },
  {
    q: "Can I change plans or cancel anytime?",
    a: "Yes. Upgrade or downgrade at any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at your next billing cycle. Cancel anytime with no penalty.",
  },
  {
    q: "What is the Done-For-You plan?",
    a: "Done-For-You is a managed creative service for agencies and brands. We handle strategy, scripting, generation, hook testing, and delivery. Contact us for a custom quote based on your volume and needs.",
  },
  {
    q: "Do annual plans get a discount?",
    a: "Yes. Annual billing saves 15% compared to monthly pricing. You are billed upfront for the full year.",
  },
  {
    q: "Are there any feature limits between plans?",
    a: "No. All cloud plans include unlimited universes, unlimited team members, all generation features, all AI models, and all export formats. Plans differ only by credit allowance, concurrent generation jobs, and support level.",
  },
];

function CreditBox({
  credits,
  clips,
  borderClass = "border-slate-700/50",
  children,
}: {
  credits: number;
  clips: number;
  borderClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl bg-slate-800/50 border ${borderClass} p-4 mb-5`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-sm font-semibold text-white">{credits.toLocaleString()} credits/mo</span>
      </div>
      <p className="text-xs text-slate-500">= ~{clips} Kling V3 Pro clips (5s)</p>
      <p className="text-xs text-slate-500">= ~{Math.round(credits / 3).toLocaleString()} keyframe images</p>
      {children}
    </div>
  );
}

function SliderControl({
  options,
  index,
  setIndex,
}: {
  options: { credits: number }[];
  index: number;
  setIndex: (i: number) => void;
}) {
  return (
    <div className="mt-4">
      <Slider
        min={0}
        max={options.length - 1}
        step={1}
        value={index}
        onChange={setIndex}
      />
      <div className="flex justify-between mt-2">
        {options.map((opt, i) => (
          <button
            key={opt.credits}
            onClick={() => setIndex(i)}
            className={`text-[10px] font-medium transition-colors ${
              i === index ? "text-white" : "text-slate-600"
            }`}
          >
            {opt.credits >= 10_000
              ? `${(opt.credits / 1000).toFixed(0)}K`
              : opt.credits.toLocaleString()}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [proIndex, setProIndex] = useState(0);
  const [studioIndex, setStudioIndex] = useState(0);

  const pro = PRO_OPTIONS[proIndex];
  const studio = STUDIO_OPTIONS[studioIndex];
  const isAnnual = billing === "annual";

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="pt-16 sm:pt-24 pb-8 sm:pb-10 px-4 sm:px-6 text-center starfield">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-logo font-bold text-white tracking-wide leading-tight">
            Pick your{" "}
            <span className="text-amber-400" style={{ textShadow: "0 0 20px rgba(251,191,36,0.3)" }}>
              plan.
            </span>
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            Scale your video production with more credits and faster generation. Self-host free forever, or use Cloud for managed infrastructure.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="border-t border-slate-800/50 pt-8 sm:pt-12 pb-16 sm:pb-24 px-4 sm:px-6 starfield">
        <div className="max-w-6xl mx-auto">

          {/* Billing toggle */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-3 rounded-full bg-slate-900 border border-slate-800 p-1">
              <button
                onClick={() => setBilling("monthly")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  !isAnnual ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-2 ${
                  isAnnual ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Annual
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isAnnual ? "bg-slate-950/20 text-slate-950" : "bg-green-500/20 text-green-400"
                }`}>
                  15% OFF
                </span>
              </button>
            </div>
          </div>

          {/* 3-column grid: Creator, Pro, Studio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Creator */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col">
              <h3 className="text-lg font-bold text-white">Creator</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">For individual creators</p>

              <CreditBox credits={1500} clips={27} />

              <div className="mb-1">
                <span className="text-3xl font-bold text-white">${isAnnual ? "25" : "29"}</span>
                <span className="text-sm text-slate-500 ml-1">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {isAnnual ? "Billed annually ($300/yr)" : "Billed monthly"}
              </p>

              <Link
                href="/app"
                className="rounded-full px-4 py-2.5 text-sm font-medium text-center bg-slate-800 text-white hover:bg-slate-700 transition-colors mb-5"
              >
                Get Plan
              </Link>

              <ul className="space-y-2 flex-1">
                {[
                  "All generation features",
                  "All AI models",
                  "Unlimited universes",
                  "Unlimited team members",
                  "1 concurrent job",
                  "Community support",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-2xl bg-slate-900 border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.08)] p-6 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold text-slate-950 uppercase tracking-wider">
                <Zap className="h-3 w-3" /> Most Popular
              </div>

              <h3 className="text-lg font-bold text-white mt-2">Pro</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">For consistent content creation</p>

              <CreditBox credits={pro.credits} clips={pro.clips} borderClass="border-amber-500/20">
                <SliderControl options={PRO_OPTIONS} index={proIndex} setIndex={setProIndex} />
              </CreditBox>

              <div className="mb-1">
                <span className="text-3xl font-bold text-white">${isAnnual ? pro.annual : pro.monthly}</span>
                <span className="text-sm text-slate-500 ml-1">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {isAnnual
                  ? `Billed annually ($${(pro.annual * 12).toLocaleString()}/yr)`
                  : "Billed monthly"}
              </p>

              <Link
                href="/app"
                className="btn-shimmer rounded-full px-4 py-2.5 text-sm font-medium text-center text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.3)] mb-5"
              >
                Get Plan
              </Link>

              <ul className="space-y-2 flex-1">
                {[
                  "All generation features",
                  "All AI models",
                  "Unlimited universes",
                  "Unlimited team members",
                  "3 concurrent jobs",
                  "Pay-as-you-go credit packs",
                  "Priority generation queue",
                  "Email support",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Studio */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col">
              <h3 className="text-lg font-bold text-white">Studio</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4">For teams and agencies</p>

              <CreditBox credits={studio.credits} clips={studio.clips}>
                <SliderControl options={STUDIO_OPTIONS} index={studioIndex} setIndex={setStudioIndex} />
              </CreditBox>

              <div className="mb-1">
                <span className="text-3xl font-bold text-white">
                  ${isAnnual ? studio.annual : studio.monthly}
                </span>
                <span className="text-sm text-slate-500 ml-1">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {isAnnual
                  ? `Billed annually ($${(studio.annual * 12).toLocaleString()}/yr)`
                  : "Billed monthly"}
              </p>

              <Link
                href="/app"
                className="rounded-full px-4 py-2.5 text-sm font-medium text-center bg-slate-800 text-white hover:bg-slate-700 transition-colors mb-5"
              >
                Get Plan
              </Link>

              <ul className="space-y-2 flex-1">
                {[
                  "All generation features",
                  "All AI models",
                  "Unlimited universes",
                  "Unlimited team members",
                  "6 concurrent jobs",
                  "Pay-as-you-go credit packs",
                  "Dedicated generation queue",
                  "API access",
                  "Slack + priority support",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Done-For-You: full-width below the 3 cards */}
          <div className="mt-5 rounded-2xl bg-slate-900 border border-cyan-500/30 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Left: description */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Done-For-You</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">We create your content</p>
                <p className="text-sm text-slate-300 leading-relaxed max-w-md">
                  Full-service AI video production. We handle strategy, scripting, generation, hook testing, and delivery. Built for agencies and brands that want hands-off video at scale.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <a
                    href="mailto:kai@lorekit.com"
                    className="rounded-full px-5 py-2.5 text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors inline-flex items-center gap-2"
                  >
                    Contact Us
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                  <span className="text-xs text-slate-600">Custom pricing based on scope</span>
                </div>
              </div>

              {/* Right: features grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                {[
                  "Everything in Studio",
                  "Dedicated content strategist",
                  "Hook testing and A/B variants",
                  "Ad creative production",
                  "Campaign management",
                  "White-label delivery",
                  "Weekly strategy calls",
                  "Guaranteed turnaround SLA",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-2 py-1">
                    <Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-400">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Compare Plans */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white text-center mb-10 sm:mb-16 tracking-wide">
            Compare plans
          </h2>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden overflow-x-auto">
            {/* Header row */}
            <div className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-slate-800 bg-slate-900/80 min-w-[640px]">
              <div />
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Creator</div>
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Pro</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Studio</div>
              <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">DFY</div>
            </div>

            {/* Price row */}
            <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-slate-800/50 min-w-[640px]">
              <div className="text-sm text-slate-400">Price</div>
              <div className="text-sm text-white font-medium">${isAnnual ? "25" : "29"}/mo</div>
              <div className="text-sm text-white font-medium">${isAnnual ? "67" : "79"}/mo+</div>
              <div className="text-sm text-white font-medium">${isAnnual ? "169" : "199"}/mo+</div>
              <div className="text-sm text-white font-medium">Custom</div>
            </div>

            {/* Credits row */}
            <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-slate-800/50 min-w-[640px]">
              <div className="text-sm text-slate-400">Credits/month</div>
              <div className="text-sm text-white">1,500</div>
              <div className="text-sm text-white">4,000 - 8,000</div>
              <div className="text-sm text-white">10,000 - 25,000</div>
              <div className="text-sm text-white">Unlimited</div>
            </div>

            {/* Category rows */}
            {COMPARE_ROWS.map((cat) => (
              <div key={cat.category}>
                <div className="px-6 py-2.5 bg-slate-800/30 min-w-[640px]">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">{cat.category}</span>
                </div>
                {cat.items.map((item) => (
                  <div key={item.label} className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-slate-800/30 min-w-[640px]">
                    <div>
                      <div className="text-sm text-slate-300">{item.label}</div>
                      {item.sub && <div className="text-[10px] text-slate-600">{item.sub}</div>}
                    </div>
                    <div className="text-sm text-slate-400">{item.creator}</div>
                    <div className="text-sm text-slate-400">{item.pro}</div>
                    <div className="text-sm text-slate-400">{item.studio}</div>
                    <div className="text-sm text-slate-400">Unlimited</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-600 mt-4">
            All plans include unlimited universes, unlimited team members, all AI models, and all export formats.
          </p>
        </div>
      </section>

      {/* Enterprise + Open Source */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Enterprise */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Enterprise</h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-md">
                  Self-hosted or cloud deployment with enterprise-grade security, SSO, and dedicated support for your organization.
                </p>
                <div className="mt-5">
                  <Link
                    href="/enterprise"
                    className="rounded-full px-5 py-2.5 text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
                  >
                    Learn More
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {[
                  { icon: Server, label: "Self-hosted deployment" },
                  { icon: Shield, label: "SSO and SAML integration" },
                  { icon: Headphones, label: "Dedicated support and SLA" },
                  { icon: Database, label: "Data residency options" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 text-slate-500 shrink-0" />
                    <span className="text-xs text-slate-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Open Source */}
          <div className="rounded-2xl bg-slate-900 border border-green-500/20 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Code className="h-5 w-5 text-green-400" />
                  <h3 className="text-lg font-bold text-white">Open Source</h3>
                </div>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-md">
                  The free tier is the whole product. Self-host LoreKit with your own API keys. MIT licensed, no limits, no credit card required. Full source code on GitHub.
                </p>
                <div className="mt-5">
                  <a
                    href="https://github.com/lorekit/lorekit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full px-5 py-2.5 text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors inline-flex items-center gap-2"
                  >
                    View on GitHub
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                {[
                  "Full source code (MIT license)",
                  "Bring your own API keys",
                  "Unlimited everything",
                  "All generation features",
                  "All AI models",
                  "No credit card required",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-2 py-1">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-400">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white text-center mb-10 sm:mb-16 tracking-wide">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-4 tracking-wide">
            Start creating today
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-lg">
            Self-host free with your own API keys, or sign up for Cloud and start generating in minutes.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/lorekit/lorekit"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Self-Host Free
            </a>
            <Link
              href="/app"
              className="btn-shimmer inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              <Sparkles className="h-4 w-4" />
              Start Cloud
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
