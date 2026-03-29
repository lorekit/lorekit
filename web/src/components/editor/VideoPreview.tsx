"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/lib/api";
import { clipUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface VideoPreviewProps {
  scenes: Scene[];
  transitions: Record<number, string>;
}

type PlayState = "idle" | "playing" | "transitioning" | "done";

export function VideoPreview({ scenes, transitions }: VideoPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const abortRef = useRef(false);

  const playableScenes = scenes.filter((s) => s.clip_url);
  const hasClips = playableScenes.length > 0;
  const totalDuration = playableScenes.reduce((sum, s) => sum + (s.duration || 3), 0);

  // Reset when scenes change
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  const stop = useCallback(() => {
    abortRef.current = true;
    setPlayState("idle");
    setCurrentIdx(0);
    setProgress(0);
    cancelAnimationFrame(rafRef.current);
    if (videoARef.current) {
      videoARef.current.pause();
      videoARef.current.style.opacity = "1";
    }
    if (videoBRef.current) {
      videoBRef.current.pause();
      videoBRef.current.style.opacity = "0";
    }
    if (overlayRef.current) {
      overlayRef.current.style.opacity = "0";
    }
  }, []);

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = setTimeout(resolve, ms);
      // Check abort in a tight loop isn't needed — we check after each await
      void id;
    });

  const applyTransition = useCallback(
    async (
      fromVideo: HTMLVideoElement,
      toVideo: HTMLVideoElement,
      type: string
    ) => {
      const overlay = overlayRef.current;
      const durationMs = 300;

      // Preload next
      toVideo.style.opacity = "0";
      toVideo.currentTime = 0;

      if (
        type === "fadeblack" ||
        type === "fade_to_black" ||
        type === "fadewhite" ||
        type === "flash"
      ) {
        // Overlay-based transition
        if (overlay) {
          overlay.style.backgroundColor =
            type === "fadewhite" || type === "flash" ? "white" : "black";
          overlay.style.transition = `opacity ${durationMs / 2}ms ease-in`;
          overlay.style.opacity = "1";
        }
        await sleep(durationMs / 2);
        if (abortRef.current) return;

        fromVideo.style.opacity = "0";
        toVideo.style.opacity = "1";
        try { await toVideo.play(); } catch { /* */ }

        if (overlay) {
          overlay.style.transition = `opacity ${durationMs / 2}ms ease-out`;
          overlay.style.opacity = "0";
        }
        await sleep(durationMs / 2);
      } else {
        // Default: crossfade
        fromVideo.style.transition = `opacity ${durationMs}ms ease`;
        toVideo.style.transition = `opacity ${durationMs}ms ease`;
        fromVideo.style.opacity = "0";
        toVideo.style.opacity = "1";
        try { await toVideo.play(); } catch { /* */ }
        await sleep(durationMs);
      }

      if (abortRef.current) return;
      fromVideo.pause();
      // Reset transitions
      fromVideo.style.transition = "";
      toVideo.style.transition = "";
    },
    []
  );

  const play = useCallback(async () => {
    if (!hasClips) return;
    abortRef.current = false;
    setPlayState("playing");
    setCurrentIdx(0);
    setProgress(0);

    const videos = [videoARef.current!, videoBRef.current!];
    let activeIdx = 0;
    let elapsed = 0;

    for (let i = 0; i < playableScenes.length; i++) {
      if (abortRef.current) return;

      const scene = playableScenes[i];
      const current = videos[activeIdx];
      const next = videos[1 - activeIdx];

      setCurrentIdx(i);

      // Load and play current
      current.src = clipUrl(scene.clip_url!);
      current.style.opacity = "1";
      current.currentTime = 0;

      try { await current.play(); } catch { /* */ }
      if (abortRef.current) return;

      // Wait for clip to end
      await new Promise<void>((resolve) => {
        const updateProgress = () => {
          if (abortRef.current) { resolve(); return; }
          const sceneElapsed = current.currentTime || 0;
          const total = elapsed + sceneElapsed;
          setProgress(totalDuration > 0 ? total / totalDuration : 0);
          rafRef.current = requestAnimationFrame(updateProgress);
        };
        rafRef.current = requestAnimationFrame(updateProgress);

        const onEnded = () => {
          current.removeEventListener("ended", onEnded);
          cancelAnimationFrame(rafRef.current);
          resolve();
        };
        current.addEventListener("ended", onEnded);
      });

      if (abortRef.current) return;
      elapsed += scene.duration || 3;

      // Apply transition to next scene
      if (i < playableScenes.length - 1) {
        const sceneNum = scene.scene_id ?? i + 1;
        const transType = transitions[sceneNum] || "fade";
        const nextScene = playableScenes[i + 1];
        next.src = clipUrl(nextScene.clip_url!);

        setPlayState("transitioning");
        await applyTransition(current, next, transType);
        if (abortRef.current) return;
        setPlayState("playing");

        activeIdx = 1 - activeIdx;
      }
    }

    setProgress(1);
    setPlayState("done");
  }, [hasClips, playableScenes, transitions, totalDuration, applyTransition]);

  // Compute scene markers on progress bar
  const markers = (() => {
    if (totalDuration <= 0) return [];
    let acc = 0;
    return playableScenes.slice(0, -1).map((s) => {
      acc += s.duration || 3;
      return acc / totalDuration;
    });
  })();

  if (!hasClips) {
    return (
      <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3">
        <p className="text-xs text-slate-500 text-center">
          Generate clips to preview
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Preview
        </h3>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        )}
        <span className="text-[10px] text-slate-500 ml-auto">
          {playableScenes.length} clips
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Video player area — 9:16 aspect ratio */}
          <div className="relative mx-auto bg-black rounded-lg overflow-hidden"
            style={{ aspectRatio: "9/16", maxHeight: "40vh", maxWidth: "calc(40vh * 9 / 16)" }}
          >
            <video
              ref={videoARef}
              className="absolute inset-0 w-full h-full object-contain"
              muted
              playsInline
              preload="metadata"
              style={{ opacity: 1 }}
            />
            <video
              ref={videoBRef}
              className="absolute inset-0 w-full h-full object-contain"
              muted
              playsInline
              preload="metadata"
              style={{ opacity: 0 }}
            />
            {/* Transition overlay */}
            <div
              ref={overlayRef}
              className="absolute inset-0 pointer-events-none"
              style={{ opacity: 0 }}
            />

            {/* Play overlay when idle */}
            {(playState === "idle" || playState === "done") && (
              <button
                type="button"
                onClick={play}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Play className="w-7 h-7 text-white ml-0.5" />
                </div>
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-[width] duration-100"
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </div>
            {/* Scene markers */}
            {markers.map((pos, i) => (
              <div
                key={i}
                className="absolute top-0 w-px h-1.5 bg-slate-600"
                style={{ left: `${pos * 100}%` }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            {playState === "playing" || playState === "transitioning" ? (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={stop}>
                <Pause className="w-4 h-4" /> Pause
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={play}>
                <Play className="w-4 h-4" />
                {playState === "done" ? "Replay" : "Play"}
              </Button>
            )}
            {playState !== "idle" && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={stop}>
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
            )}
            <span className="text-[10px] text-slate-500 ml-2">
              Scene {currentIdx + 1}/{playableScenes.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
