import Link from "next/link";
import {
  Film, Image, PlayCircle, ScrollText, RefreshCw, Pen, LayoutGrid,
  Megaphone, Zap, Share2, MonitorPlay, Music, Clapperboard,
  Sparkles, ArrowRight, ArrowUpRight, Palette, ShoppingBag, Camera,
} from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCtaHref } from "@/lib/mode";

const FEATURES = [
  {
    id: "text-to-video",
    icon: Film,
    title: "Text-to-Video",
    description: "Generate video clips from text prompts. Describe a scene and watch it come to life.",
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    iconColor: "text-amber-400",
  },
  {
    id: "text-to-image",
    icon: Image,
    title: "Text-to-Image",
    description: "Create keyframe images from text descriptions. AI-generated visuals for any scene.",
    gradient: "from-cyan-500/20 via-blue-500/10 to-transparent",
    iconColor: "text-cyan-400",
  },
  {
    id: "image-to-video",
    icon: PlayCircle,
    title: "Image-to-Video",
    description: "Turn a static image into a video clip with motion, camera moves, and transitions.",
    gradient: "from-purple-500/20 via-violet-500/10 to-transparent",
    iconColor: "text-purple-400",
  },
  {
    id: "script-to-video",
    icon: ScrollText,
    title: "Script-to-Video",
    description: "Write a full script and generate a complete video with scenes, narration, and music.",
    gradient: "from-green-500/20 via-emerald-500/10 to-transparent",
    iconColor: "text-green-400",
  },
  {
    id: "video-to-video",
    icon: RefreshCw,
    title: "Video-to-Video",
    description: "Transform existing video with new styles, effects, and AI-powered enhancements.",
    gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
    iconColor: "text-rose-400",
  },
  {
    id: "script-generator",
    icon: Pen,
    title: "Script Generator",
    description: "AI writes your script from a brief. Story arcs, ad structures, or viral hooks.",
    gradient: "from-amber-500/20 via-yellow-500/10 to-transparent",
    iconColor: "text-amber-400",
  },
  {
    id: "carousel-generator",
    icon: LayoutGrid,
    title: "Carousel Generator",
    description: "Create multi-slide carousel content for Instagram, LinkedIn, and social platforms.",
    gradient: "from-cyan-500/20 via-teal-500/10 to-transparent",
    iconColor: "text-cyan-400",
  },
];

const USE_CASES = [
  {
    id: "brand-storytelling",
    icon: Film,
    title: "Brand Storytelling",
    description: "Build a universe for your brand and generate consistent video content across every platform.",
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    iconColor: "text-amber-400",
  },
  {
    id: "ad-creation",
    icon: Megaphone,
    title: "Ad Creation",
    description: "Script, generate, and test video ads in minutes. Create hook variants and ship what converts.",
    gradient: "from-cyan-500/20 via-blue-500/10 to-transparent",
    iconColor: "text-cyan-400",
  },
  {
    id: "short-form-content",
    icon: Zap,
    title: "Short-Form Content",
    description: "Rapid montage clips for TikTok, Reels, and Shorts. Punchy scenes with text overlays and music.",
    gradient: "from-purple-500/20 via-violet-500/10 to-transparent",
    iconColor: "text-purple-400",
  },
  {
    id: "social-media-content",
    icon: Share2,
    title: "Social Media Content",
    description: "Turn one brand universe into unlimited content. Stay on-brand across every platform.",
    gradient: "from-green-500/20 via-emerald-500/10 to-transparent",
    iconColor: "text-green-400",
  },
  {
    id: "youtube-video-editor",
    icon: MonitorPlay,
    title: "YouTube Video Editor",
    description: "Create scroll-stopping YouTube content. AI-generated scenes, voiceover, and music.",
    gradient: "from-red-500/20 via-rose-500/10 to-transparent",
    iconColor: "text-red-400",
  },
  {
    id: "tiktok-video-editor",
    icon: Zap,
    title: "TikTok Video Editor",
    description: "Create viral TikTok content. Vertical video, trending formats, and fast cuts.",
    gradient: "from-pink-500/20 via-fuchsia-500/10 to-transparent",
    iconColor: "text-pink-400",
  },
  {
    id: "instagram-video-editor",
    icon: Camera,
    title: "Instagram Video Editor",
    description: "Professional Instagram video. Create viral Reels, Stories, and feed posts.",
    gradient: "from-orange-500/20 via-amber-500/10 to-transparent",
    iconColor: "text-orange-400",
  },
  {
    id: "ugc-ad-editor",
    icon: ShoppingBag,
    title: "UGC and Ad Editor",
    description: "Create high-converting UGC-style ads without creators or filming.",
    gradient: "from-cyan-500/20 via-sky-500/10 to-transparent",
    iconColor: "text-cyan-400",
  },
  {
    id: "ai-ad-generator",
    icon: Megaphone,
    title: "AI Ad Generator",
    description: "Generate video ads from a product description. Hook, problem, solution, CTA.",
    gradient: "from-emerald-500/20 via-green-500/10 to-transparent",
    iconColor: "text-emerald-400",
  },
  {
    id: "ai-anime-generator",
    icon: Palette,
    title: "AI Anime Generator",
    description: "Generate anime-style characters, scenes, and stories. No drawing skills needed.",
    gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
    iconColor: "text-violet-400",
  },
  {
    id: "music-video-maker",
    icon: Music,
    title: "Music Video Maker",
    description: "Create music videos with AI-generated visuals synced to your audio track.",
    gradient: "from-fuchsia-500/20 via-pink-500/10 to-transparent",
    iconColor: "text-fuchsia-400",
  },
  {
    id: "movie-trailer-generator",
    icon: Clapperboard,
    title: "Movie Trailer Generator",
    description: "Generate cinematic trailers and teasers from your script or story outline.",
    gradient: "from-amber-500/20 via-yellow-500/10 to-transparent",
    iconColor: "text-amber-400",
  },
];

function ProductCard({ id, icon: Icon, title, description, gradient, iconColor }: typeof FEATURES[0]) {
  return (
    <div id={id} className="group rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-slate-700 transition-colors duration-300 flex flex-col">
      {/* Image placeholder */}
      <div className={`h-40 sm:h-48 relative bg-gradient-to-br ${gradient} bg-slate-800/50 flex items-center justify-center`}>
        <Icon className={`h-10 w-10 ${iconColor} opacity-60 group-hover:opacity-100 transition-opacity`} />
      </div>
      {/* Content */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed flex-1">{description}</p>
        <div className="mt-4 flex items-center gap-1 text-sm text-slate-500 group-hover:text-amber-400 transition-colors">
          Explore <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 text-center starfield">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl font-logo font-bold text-white tracking-wide leading-tight">
            Everything you can{" "}
            <span className="text-amber-400" style={{ textShadow: "0 0 20px rgba(251,191,36,0.3)" }}>
              create.
            </span>
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            AI-powered video and image creation tools. From text prompts to finished videos, scripts to social content. Open source.
          </p>
        </div>
      </section>

      {/* Features section */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-8">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => (
              <ProductCard key={feature.id} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Use cases section */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-8">Use Cases</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {USE_CASES.map((uc) => (
              <ProductCard key={uc.id} {...uc} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/50 py-16 sm:py-24 px-4 sm:px-6 starfield">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl sm:text-3xl font-logo font-bold text-white mb-4 tracking-wide">
            Start creating
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-lg">
            Pick a tool or use case and generate your first video in minutes. Free and open source.
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
