import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  xs: { img: 44, text: "text-lg", gap: "gap-2" },
  sm: { img: 72, text: "text-2xl", gap: "gap-3" },
  md: { img: 80, text: "text-3xl", gap: "gap-3.5" },
  lg: { img: 96, text: "text-5xl", gap: "gap-4" },
};

export function Logo({ size = "sm", showText = true, className }: LogoProps) {
  const s = sizes[size];
  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <Image
        src="/logo.png"
        alt="LoreKit"
        width={s.img}
        height={s.img}
        className="flex-shrink-0"
      />
      {showText && (
        <span className={cn(s.text, "font-logo font-bold leading-none")}>
          <span className="text-amber-400" style={{ textShadow: "0 0 10px rgba(251,191,36,0.6), 0 0 30px rgba(251,191,36,0.3), 0 0 50px rgba(251,191,36,0.1)" }}>
            <span className="inline-block font-logo-deco text-[1.4em] translate-y-[0.15em]">L</span>ore
          </span>
          <span className="text-cyan-400" style={{ textShadow: "0 0 10px rgba(34,211,238,0.6), 0 0 30px rgba(34,211,238,0.3), 0 0 50px rgba(34,211,238,0.1)" }}>
            <span className="inline-block font-logo-deco text-[1.4em] translate-y-[0.15em] ml-0.5">K</span>it
          </span>
        </span>
      )}
    </span>
  );
}
