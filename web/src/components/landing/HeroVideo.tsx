"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const HERO_CLIPS = ["/hero-1.mp4", "/hero-2.mp4", "/hero-3.mp4", "/hero-4.mp4"];

export function HeroVideo() {
  const [active, setActive] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const play = useCallback((idx: number) => {
    setActive(idx);
    const v = videoRef.current;
    if (!v) return;
    v.src = HERO_CLIPS[idx];
    v.load();
    v.play().catch(() => {});
  }, []);

  // Auto-advance when clip ends
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnded = () => play((active + 1) % HERO_CLIPS.length);
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [active, play]);

  // Initial load
  useEffect(() => { play(0); }, [play]);

  return (
    <>
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
      />
      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {HERO_CLIPS.map((_, i) => (
          <button
            key={i}
            onClick={() => play(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === active
                ? "bg-amber-400 w-6"
                : "bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Play clip ${i + 1}`}
          />
        ))}
      </div>
    </>
  );
}
