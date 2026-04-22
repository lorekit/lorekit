"use client";

import { useState, useRef, useEffect } from "react";

const HERO_CLIPS = ["/hero-1.mp4", "/hero-2.mp4", "/hero-3.mp4", "/hero-4.mp4"];

export function HeroVideo() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);

  // Play the active video, pause the rest
  useEffect(() => {
    refs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [active]);

  // Auto-advance when clip ends
  useEffect(() => {
    const v = refs.current[active];
    if (!v) return;
    const onEnded = () => setActive((active + 1) % HERO_CLIPS.length);
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [active]);

  return (
    <>
      {HERO_CLIPS.map((src, i) => (
        <video
          key={src}
          ref={(el) => { refs.current[i] = el; }}
          src={src}
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${
            i === active ? "opacity-40" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {HERO_CLIPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === active ? "bg-amber-400 w-6" : "bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Play clip ${i + 1}`}
          />
        ))}
      </div>
    </>
  );
}
