"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const HERO_CLIPS = ["/hero-1.mp4", "/hero-2.mp4", "/hero-3.mp4", "/hero-4.mp4"];

export function HeroVideo() {
  const [active, setActive] = useState(0);
  const [front, setFront] = useState<"a" | "b">("a");
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);

  const play = useCallback((idx: number) => {
    setActive(idx);
    // Load the new clip into the back video, then swap to front
    const next = front === "a" ? "b" : "a";
    const nextVideo = next === "a" ? videoA.current : videoB.current;
    if (!nextVideo) return;
    nextVideo.src = HERO_CLIPS[idx];
    nextVideo.load();
    nextVideo.play().catch(() => {});
    setFront(next);
  }, [front]);

  // Auto-advance when the front video ends
  useEffect(() => {
    const v = front === "a" ? videoA.current : videoB.current;
    if (!v) return;
    const onEnded = () => play((active + 1) % HERO_CLIPS.length);
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [active, front, play]);

  // Initial load
  useEffect(() => {
    const v = videoA.current;
    if (!v) return;
    v.src = HERO_CLIPS[0];
    v.load();
    v.play().catch(() => {});
  }, []);

  const base = "absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700";

  return (
    <>
      <video ref={videoA} muted playsInline className={`${base} ${front === "a" ? "opacity-40" : "opacity-0"}`} />
      <video ref={videoB} muted playsInline className={`${base} ${front === "b" ? "opacity-40" : "opacity-0"}`} />
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
