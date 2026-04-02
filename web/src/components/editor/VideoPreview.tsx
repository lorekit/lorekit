"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/lib/api";
import { clipUrl } from "@/lib/api";

interface TransitionClip {
  from_scene_id: number;
  to_scene_id: number;
  clip_path: string;
}

interface VideoPreviewProps {
  scenes: Scene[];
  transitionClips?: Record<string, TransitionClip>;
  audioUrl?: string | null;
}

type PlayState = "idle" | "playing" | "transitioning" | "done";

export function VideoPreview({ scenes, transitionClips, audioUrl }: VideoPreviewProps) {
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [totalRealDuration, setTotalRealDuration] = useState(0);

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const abortRef = useRef(false);
  const elapsedRef = useRef(0);

  const playableScenes = scenes.filter((s) => s.clip_url);
  const hasClips = playableScenes.length > 0;

  useEffect(() => {
    stop();
    // Precompute total real duration by loading metadata for all clips
    let cancelled = false;
    async function computeDurations() {
      let total = 0;
      for (const scene of playableScenes) {
        if (cancelled) return;
        const dur = await getVideoDuration(clipUrl(scene.clip_url!));
        total += dur / (scene.speed ?? 1.0);
      }
      if (!cancelled) setTotalRealDuration(total);
    }
    computeDurations();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  const stop = useCallback(() => {
    abortRef.current = true;
    setPlayState("idle");
    setCurrentIdx(0);
    setProgress(0);
    elapsedRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    if (videoARef.current) { videoARef.current.pause(); videoARef.current.style.opacity = "1"; }
    if (videoBRef.current) { videoBRef.current.pause(); videoBRef.current.style.opacity = "0"; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  }, []);

  const play = useCallback(async () => {
    if (!hasClips) return;
    abortRef.current = false;
    setPlayState("playing");
    setCurrentIdx(0);
    setProgress(0);
    elapsedRef.current = 0;

    // Start audio
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = 0;
      try { await audioRef.current.play(); } catch { /* */ }
    }

    const videos = [videoARef.current!, videoBRef.current!];
    let activeIdx = 0;

    for (let i = 0; i < playableScenes.length; i++) {
      if (abortRef.current) return;

      const scene = playableScenes[i];
      const current = videos[activeIdx];
      const speed = scene.speed ?? 1.0;

      setCurrentIdx(i);
      current.src = clipUrl(scene.clip_url!);
      current.style.opacity = "1";
      current.currentTime = 0;
      current.playbackRate = speed;

      try { await current.play(); } catch { /* */ }
      if (abortRef.current) return;

      // Wait for clip to end, track real progress
      await new Promise<void>((resolve) => {
        const updateProgress = () => {
          if (abortRef.current) { resolve(); return; }
          const sceneElapsed = current.currentTime || 0;
          const total = elapsedRef.current + sceneElapsed;
          setProgress(totalRealDuration > 0 ? total / totalRealDuration : 0);
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
      elapsedRef.current += (current.duration || 0) / speed;

      // Transition to next scene
      if (i < playableScenes.length - 1) {
        const sceneNum = scene.scene_id ?? i + 1;
        const nextScene = playableScenes[i + 1];
        const nextSceneNum = nextScene.scene_id ?? i + 2;
        const next = videos[1 - activeIdx];

        // Check for AI transition clip
        const transKey = `${sceneNum}_${nextSceneNum}`;
        const aiClip = transitionClips?.[transKey];

        if (aiClip?.clip_path) {
          // Play AI transition clip sped up 1.5x
          setPlayState("transitioning");
          current.style.opacity = "0";
          next.src = clipUrl(`/files/${aiClip.clip_path}`);
          next.style.opacity = "1";
          next.currentTime = 0.25;
          next.playbackRate = 1.5;
          try { await next.play(); } catch { /* */ }

          await new Promise<void>((resolve) => {
            const onEnded = () => { next.removeEventListener("ended", onEnded); resolve(); };
            next.addEventListener("ended", onEnded);
          });
          next.playbackRate = 1.0;
          if (abortRef.current) return;
          elapsedRef.current += (next.duration || 0) / 1.5;

          // Swap back for next scene
          current.src = clipUrl(nextScene.clip_url!);
          current.style.opacity = "1";
          next.style.opacity = "0";
          next.pause();
          setPlayState("playing");
        } else {
          // Hard cut — no transition clip exists yet
          current.style.opacity = "0";
          next.src = clipUrl(nextScene.clip_url!);
          next.style.opacity = "1";
          next.currentTime = 0;
          current.pause();
          activeIdx = 1 - activeIdx;
          setPlayState("playing");
        }
      }
    }

    // Stop audio when done
    if (audioRef.current) audioRef.current.pause();
    setProgress(1);
    setPlayState("done");
  }, [hasClips, playableScenes, transitionClips, totalRealDuration, audioUrl]);

  // Compute scene markers based on real durations
  const markers = (() => {
    if (totalRealDuration <= 0) return [];
    let acc = 0;
    // Use equal segments as approximation (real durations computed async)
    const avgDur = totalRealDuration / playableScenes.length;
    return playableScenes.slice(0, -1).map(() => {
      acc += avgDur;
      return acc / totalRealDuration;
    });
  })();

  if (!hasClips) return null;

  return (
    <div className="space-y-3">
      {/* Video player — 9:16 */}
      <div
        className="relative mx-auto bg-black rounded-lg overflow-hidden"
        style={{ aspectRatio: "9/16", maxHeight: "60vh", maxWidth: "calc(60vh * 9 / 16)" }}
      >
        <video
          ref={videoARef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          preload="metadata"
          style={{ opacity: 1 }}
        />
        <video
          ref={videoBRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          preload="metadata"
          style={{ opacity: 0 }}
        />
        {/* Audio element for background track */}
        {audioUrl && <audio ref={audioRef} src={clipUrl(audioUrl)} preload="auto" />}

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
        {markers.map((pos, i) => (
          <div key={i} className="absolute top-0 w-px h-1.5 bg-slate-600" style={{ left: `${pos * 100}%` }} />
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
  );
}

/** Load a video's metadata to get its real duration */
function getVideoDuration(src: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(v.duration || 3); v.remove(); };
    v.onerror = () => { resolve(3); v.remove(); };
    v.src = src;
  });
}
