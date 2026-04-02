import Link from "next/link";
import { Globe, Film, Mic, Code, ArrowRight, ScrollText, Sparkles } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

// Fixed sparkle positions (no Math.random — SSR safe)
const SPARKLES = [
  { left: "8%", top: "15%", size: 3, delay: 0, dur: 6, color: "rgba(251,191,36,0.5)" },
  { left: "15%", top: "70%", size: 2, delay: 1.2, dur: 7, color: "rgba(255,255,255,0.4)" },
  { left: "22%", top: "35%", size: 4, delay: 2.5, dur: 5.5, color: "rgba(34,211,238,0.4)" },
  { left: "35%", top: "80%", size: 2, delay: 0.8, dur: 8, color: "rgba(251,191,36,0.3)" },
  { left: "42%", top: "20%", size: 3, delay: 3.2, dur: 6.5, color: "rgba(255,255,255,0.35)" },
  { left: "55%", top: "60%", size: 2, delay: 1.5, dur: 7.5, color: "rgba(34,211,238,0.35)" },
  { left: "62%", top: "25%", size: 3, delay: 4, dur: 5, color: "rgba(251,191,36,0.45)" },
  { left: "70%", top: "75%", size: 2, delay: 0.5, dur: 6.8, color: "rgba(255,255,255,0.3)" },
  { left: "78%", top: "40%", size: 4, delay: 2, dur: 7.2, color: "rgba(34,211,238,0.4)" },
  { left: "85%", top: "15%", size: 2, delay: 3.5, dur: 6, color: "rgba(251,191,36,0.35)" },
  { left: "92%", top: "55%", size: 3, delay: 1, dur: 5.8, color: "rgba(255,255,255,0.4)" },
  { left: "18%", top: "50%", size: 2, delay: 4.5, dur: 7, color: "rgba(34,211,238,0.3)" },
  { left: "48%", top: "45%", size: 3, delay: 2.8, dur: 6.3, color: "rgba(251,191,36,0.4)" },
  { left: "75%", top: "65%", size: 2, delay: 0.3, dur: 8.2, color: "rgba(255,255,255,0.35)" },
  { left: "30%", top: "10%", size: 4, delay: 3.8, dur: 5.5, color: "rgba(34,211,238,0.45)" },
];

const DIAMONDS = [
  { left: "12%", top: "30%", delay: 1, dur: 8, color: "rgba(251,191,36,0.4)" },
  { left: "88%", top: "20%", delay: 3, dur: 7, color: "rgba(34,211,238,0.35)" },
  { left: "50%", top: "70%", delay: 5, dur: 9, color: "rgba(251,191,36,0.3)" },
  { left: "25%", top: "55%", delay: 2, dur: 6, color: "rgba(34,211,238,0.4)" },
  { left: "72%", top: "45%", delay: 4, dur: 7.5, color: "rgba(255,255,255,0.3)" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="relative min-h-[70vh] sm:min-h-[80vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 py-16 sm:py-24 overflow-hidden">
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          src="/hero.mp4"
        />

        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(245,158,11,0.08) 0%, rgba(34,211,238,0.03) 40%, transparent 70%)",
          }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/40 to-slate-950" />

        <div className="relative z-10">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-logo font-bold tracking-wide max-w-4xl leading-tight">
            <span className="text-white" style={{ textShadow: "0 0 30px rgba(255,255,255,0.1)" }}>
              Every person has a story.{" "}
            </span>
            <span className="text-amber-400" style={{ textShadow: "0 0 20px rgba(251,191,36,0.3), 0 0 40px rgba(251,191,36,0.1)" }}>
              Our mission
            </span>
            <span className="text-white" style={{ textShadow: "0 0 30px rgba(255,255,255,0.1)" }}>
              {" "}is to help you{" "}
            </span>
            <span className="text-cyan-400" style={{ textShadow: "0 0 20px rgba(34,211,238,0.3), 0 0 40px rgba(34,211,238,0.1)" }}>
              tell yours.
            </span>
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-xl text-slate-400 max-w-2xl mx-auto px-2">
            Storytelling is the oldest form of education. Turn your story into universes filled with characters, environments, and visual styles.
          </p>
          <div className="mt-8 sm:mt-10 flex items-center gap-4 justify-center">
            <Link
              href="/app"
              className="btn-shimmer rounded-full px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-slate-950 flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              <Sparkles className="h-4 w-4" />
              Start Creating
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 relative starfield">
        {/* Sparkle particles — clipped to this section */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {SPARKLES.map((s, i) => (
            <div
              key={i}
              className="sparkle"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                backgroundColor: s.color,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.dur}s`,
                boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
              }}
            />
          ))}
          {DIAMONDS.map((d, i) => (
            <div
              key={`d${i}`}
              className="sparkle-diamond"
              style={{
                left: d.left,
                top: d.top,
                color: d.color,
                animationDelay: `${d.delay}s`,
                animationDuration: `${d.dur}s`,
              }}
            />
          ))}
        </div>
        <div className="max-w-5xl mx-auto relative z-10">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white text-center mb-10 sm:mb-16 tracking-wide" style={{ textShadow: "0 0 20px rgba(255,255,255,0.08)" }}>
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-7 left-[16.6%] right-[16.6%] h-px bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-amber-500/20" />

            {[
              {
                step: "1",
                title: "Build your universe",
                description:
                  "Create a world with characters, environments, and visual styles. Define who lives in your story.",
                icon: Globe,
                glow: "rgba(245,158,11,0.15)",
              },
              {
                step: "2",
                title: "Write your story",
                description:
                  "Describe your scenes or let AI break them down for you. Scripts, beats, and narration all in one place.",
                icon: ScrollText,
                glow: "rgba(34,211,238,0.12)",
              },
              {
                step: "3",
                title: "Watch it come to life",
                description:
                  "AI generates keyframes, video clips, voiceover, and music. Export a finished video ready to share.",
                icon: Film,
                glow: "rgba(245,158,11,0.15)",
              },
            ].map((item) => (
              <div key={item.step} className="text-center relative">
                <div
                  className="mx-auto h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 glow-ring"
                  style={{ boxShadow: `0 0 20px ${item.glow}, 0 0 40px ${item.glow}` }}
                >
                  <item.icon className="h-6 w-6 text-amber-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 relative starfield">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white text-center mb-10 sm:mb-16 tracking-wide" style={{ textShadow: "0 0 20px rgba(255,255,255,0.08)" }}>
            Everything you need
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Universe Builder — mini character cards */}
            <div className="group rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-amber-500/30 transition-colors duration-300">
              <div className="h-36 sm:h-44 relative bg-gradient-to-br from-slate-800/80 to-slate-900 p-4 sm:p-5 overflow-hidden">
                {/* Mini character cards */}
                <div className="flex gap-3 justify-center">
                  <div className="w-20 rounded-lg bg-slate-800 border border-slate-700 p-2 shadow-lg -rotate-3 translate-y-1">
                    <div className="w-full aspect-square rounded bg-amber-500/20 mb-1.5 flex items-center justify-center">
                      <span className="text-lg">🧙</span>
                    </div>
                    <div className="h-1.5 w-10 rounded-full bg-slate-600" />
                    <div className="h-1 w-7 rounded-full bg-slate-700 mt-1" />
                  </div>
                  <div className="w-20 rounded-lg bg-slate-800 border border-amber-500/20 p-2 shadow-lg shadow-amber-500/5 rotate-1 -translate-y-1">
                    <div className="w-full aspect-square rounded bg-cyan-500/20 mb-1.5 flex items-center justify-center">
                      <span className="text-lg">⚔️</span>
                    </div>
                    <div className="h-1.5 w-10 rounded-full bg-slate-600" />
                    <div className="h-1 w-7 rounded-full bg-slate-700 mt-1" />
                  </div>
                  <div className="w-20 rounded-lg bg-slate-800 border border-slate-700 p-2 shadow-lg rotate-3 translate-y-2">
                    <div className="w-full aspect-square rounded bg-purple-500/20 mb-1.5 flex items-center justify-center">
                      <span className="text-lg">🏰</span>
                    </div>
                    <div className="h-1.5 w-10 rounded-full bg-slate-600" />
                    <div className="h-1 w-7 rounded-full bg-slate-700 mt-1" />
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <Globe className="h-4 w-4 text-amber-400" />
                  <h3 className="text-base font-semibold text-white">Universe Builder</h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">Characters with portraits and voices. Environments, visual presets, and source material for your world.</p>
              </div>
            </div>

            {/* AI Video Generation — mini timeline */}
            <div className="group rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-cyan-500/30 transition-colors duration-300">
              <div className="h-36 sm:h-44 relative bg-gradient-to-br from-slate-800/80 to-slate-900 p-4 sm:p-5 overflow-hidden">
                {/* Mini video timeline */}
                <div className="space-y-2.5">
                  <div className="flex gap-1.5">
                    <div className="h-14 flex-1 rounded bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center text-[10px] text-cyan-400 font-medium">Scene 1</div>
                    <div className="h-14 flex-1 rounded bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center text-[10px] text-cyan-400/60 font-medium">Scene 2</div>
                    <div className="h-14 flex-1 rounded bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center text-[10px] text-cyan-400/60 font-medium">Scene 3</div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="flex-1 h-6 rounded-sm" style={{ backgroundColor: `rgba(34,211,238,${0.08 + (i < 4 ? 0.12 : 0)})` }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-slate-700">
                      <div className="h-1 w-1/3 rounded-full bg-cyan-500" />
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">0:04 / 0:12</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <Film className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-base font-semibold text-white">AI Video Generation</h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">Scene-by-scene keyframes rendered into video clips with transitions, camera moves, and visual storytelling.</p>
              </div>
            </div>

            {/* Voice & Audio — mini waveform */}
            <div className="group rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-purple-500/30 transition-colors duration-300">
              <div className="h-36 sm:h-44 relative bg-gradient-to-br from-slate-800/80 to-slate-900 p-4 sm:p-5 overflow-hidden flex flex-col justify-center">
                {/* Mini audio mixer */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-purple-400 w-12 shrink-0">Voice</span>
                    <div className="flex-1 flex items-center gap-0.5 h-5">
                      {[3,5,8,12,10,14,8,11,6,9,13,7,10,5,8,12,6,9,4,7,11,8,5,10,7].map((h, i) => (
                        <div key={i} className="flex-1 rounded-full bg-purple-500/40" style={{ height: `${h * 1.2}px` }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-amber-400 w-12 shrink-0">Music</span>
                    <div className="flex-1 flex items-center gap-0.5 h-5">
                      {[2,3,4,3,5,4,6,5,4,3,5,6,4,3,5,4,3,5,6,4,3,2,4,3,5].map((h, i) => (
                        <div key={i} className="flex-1 rounded-full bg-amber-500/30" style={{ height: `${h * 1.2}px` }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 w-12 shrink-0">SFX</span>
                    <div className="flex-1 flex items-center gap-0.5 h-5">
                      {[0,0,0,1,0,0,0,0,3,0,0,0,0,0,2,0,0,0,0,0,0,4,0,0,0].map((h, i) => (
                        <div key={i} className="flex-1 rounded-full bg-slate-500/30" style={{ height: `${Math.max(h * 1.5, 1)}px` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <Mic className="h-4 w-4 text-purple-400" />
                  <h3 className="text-base font-semibold text-white">Voice & Audio</h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">AI narration with character voices, music beds, and sound effects. Automatically mixed into a polished soundtrack.</p>
              </div>
            </div>

            {/* Open Source — mini terminal */}
            <div className="group rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-green-500/30 transition-colors duration-300">
              <div className="h-36 sm:h-44 relative bg-gradient-to-br from-slate-800/80 to-slate-900 p-3 sm:p-4 overflow-hidden">
                {/* Mini terminal */}
                <div className="rounded-lg bg-slate-950 border border-slate-700 h-full flex flex-col overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-red-500/60" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                    <div className="w-2 h-2 rounded-full bg-green-500/60" />
                    <span className="text-[9px] text-slate-500 ml-2 font-mono">terminal</span>
                  </div>
                  <div className="flex-1 px-3 py-2 font-mono text-[10px] leading-relaxed space-y-1">
                    <p><span className="text-green-400">$</span> <span className="text-slate-300">pip install lorekit</span></p>
                    <p><span className="text-green-400">$</span> <span className="text-slate-300">lorekit init</span></p>
                    <p className="text-slate-500">Initialized LoreKit project</p>
                    <p><span className="text-green-400">$</span> <span className="text-slate-300">lorekit dev</span></p>
                    <p className="text-amber-400">Server running on :8001</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <Code className="h-4 w-4 text-green-400" />
                  <h3 className="text-base font-semibold text-white">Open Source</h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">MIT licensed. Self-host it, bring your own API keys, own your data. No vendor lock-in, full creative control.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 relative starfield">
        {/* Sparkle particles — clipped to this section */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {SPARKLES.slice(0, 10).map((s, i) => (
            <div
              key={i}
              className="sparkle"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                backgroundColor: s.color,
                animationDelay: `${s.delay + 2}s`,
                animationDuration: `${s.dur}s`,
                boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
              }}
            />
          ))}
          {DIAMONDS.slice(0, 3).map((d, i) => (
            <div
              key={`d${i}`}
              className="sparkle-diamond"
              style={{
                left: d.left,
                top: d.top,
                color: d.color,
                animationDelay: `${d.delay + 1}s`,
                animationDuration: `${d.dur}s`,
              }}
            />
          ))}
        </div>
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(245,158,11,0.06) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-4 tracking-wide" style={{ textShadow: "0 0 20px rgba(255,255,255,0.08)" }}>
            Start telling your story
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-lg px-2">
            Create your first universe and generate a video in minutes.
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
