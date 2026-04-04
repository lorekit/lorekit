import Link from "next/link";
import { Server, Shield, Headphones, Cpu, Database, Clock, ArrowRight, Code } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

const CAPABILITIES = [
  {
    icon: Server,
    title: "Self-hosted deployment",
    description: "Run LoreKit on your own infrastructure. Docker, Kubernetes, or bare metal. Your data never leaves your network.",
    iconColor: "text-amber-400",
  },
  {
    icon: Shield,
    title: "SSO and SAML",
    description: "Integrate with your identity provider. Single sign-on, role-based access control, and audit logging.",
    iconColor: "text-cyan-400",
  },
  {
    icon: Headphones,
    title: "Dedicated support",
    description: "Direct access to the engineering team. Guaranteed response times and a dedicated point of contact.",
    iconColor: "text-purple-400",
  },
  {
    icon: Cpu,
    title: "Custom model integration",
    description: "Bring your own AI models or use fine-tuned versions. We help you integrate custom image, video, and voice models.",
    iconColor: "text-green-400",
  },
  {
    icon: Database,
    title: "Data residency",
    description: "Choose where your data lives. On-prem, specific cloud regions, or air-gapped environments.",
    iconColor: "text-amber-400",
  },
  {
    icon: Clock,
    title: "SLA guarantees",
    description: "Uptime commitments, priority bug fixes, and guaranteed support response times tailored to your needs.",
    iconColor: "text-cyan-400",
  },
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 text-center starfield">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 text-xs text-cyan-400 font-medium mb-6">
            Enterprise
          </div>
          <h1 className="text-3xl sm:text-5xl font-logo font-bold text-white tracking-wide leading-tight">
            AI video creation{" "}
            <span className="text-cyan-400" style={{ textShadow: "0 0 20px rgba(34,211,238,0.3)" }}>
              for your organization.
            </span>
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            Self-hosted or cloud. Full creative control with enterprise-grade security. Built on open source, so you can inspect every line.
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <a
              href="mailto:kai@lorekit.com"
              className="btn-shimmer rounded-full px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-slate-950 flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              Contact Us
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="https://github.com/anthropics/lorekit"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-medium text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <Code className="h-4 w-4" />
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white text-center mb-10 sm:mb-16 tracking-wide">
            Enterprise capabilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} className="rounded-xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
                <cap.icon className={`h-5 w-5 ${cap.iconColor} mb-3`} />
                <h3 className="text-sm font-semibold text-white mb-1.5">{cap.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-6 tracking-wide">
            Built on trust, not lock-in
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto mb-10">
            LoreKit is MIT licensed. The entire codebase is public. You can audit every line of code, fork it, and run it on your own terms. Enterprise support is about helping you deploy and scale it, not about locking you in.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-lg font-bold text-amber-400 mb-1">MIT Licensed</div>
              <div className="text-xs text-slate-500">Full commercial use, no restrictions</div>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-lg font-bold text-cyan-400 mb-1">100% Open Source</div>
              <div className="text-xs text-slate-500">Inspect, audit, and fork the code</div>
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5">
              <div className="text-lg font-bold text-green-400 mb-1">Your Infrastructure</div>
              <div className="text-xs text-slate-500">Self-host on any cloud or on-prem</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-4 tracking-wide">
            Let's talk about your needs
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-lg">
            We will work with your team to scope deployment, integrations, and support. No sales pitch, just a conversation.
          </p>
          <a
            href="mailto:kai@lorekit.com"
            className="btn-shimmer inline-flex items-center gap-2 rounded-full px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            Contact Us
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
