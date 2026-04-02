import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) {
    return `${m}:${Math.round(s).toString().padStart(2, "0")}`;
  }
  // Show 1 decimal place, drop ".0" for clean integers
  const rounded = Math.round(s * 10) / 10;
  return rounded % 1 === 0 ? `${rounded}s` : `${rounded.toFixed(1)}s`;
}

// Beat colors
export const BEAT_COLORS: Record<string, string> = {
  HOOK: "bg-red-500",
  WORLD: "bg-blue-500",
  CONFLICT: "bg-orange-500",
  STILLNESS: "bg-purple-500",
  TRUTH: "bg-amber-500",
  LOOP: "bg-slate-500",
};

export const BEAT_TEXT_COLORS: Record<string, string> = {
  HOOK: "text-red-400",
  WORLD: "text-blue-400",
  CONFLICT: "text-orange-400",
  STILLNESS: "text-purple-400",
  TRUTH: "text-amber-400",
  LOOP: "text-slate-400",
};

export const CIV_COLORS: Record<string, string> = {
  Roman: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Chinese: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Japanese: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  Greek: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};
