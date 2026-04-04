"use client";

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/lib/api";
import { clipUrl } from "@/lib/api";
import { useColorGradeGL } from "./useColorGradeGL";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TransitionClip {
  from_scene_id: number;
  to_scene_id: number;
  clip_path: string;
}

/** Segment timing info shared with the timeline */
export interface SegmentTiming {
  type: "scene" | "transition";
  sceneIdx?: number;
  wallStart: number;
  wallEnd: number;
}

export interface ColorGradeSettings {
  temperature: number;
  saturation: number;
  contrast: number;
  vignette: number;
}

interface VideoPreviewProps {
  scenes: Scene[];
  transitionClips?: Record<string, TransitionClip>;
  audioUrl?: string | null;
  /** Called with 0-1 progress during playback, null when stopped */
  onProgressUpdate?: (progress: number | null) => void;
  /** Called when segments are built with actual measured durations */
  onSegmentsReady?: (segments: SegmentTiming[], totalDuration: number) => void;
  /** Live color grading preview via CSS filters */
  colorGrade?: ColorGradeSettings | null;
  /** Pre-measured audio duration (single source of truth, avoids double-measurement) */
  audioDuration?: number;
}

export interface VideoPreviewHandle {
  seekTo: (wallTime: number) => void;
  seekToFraction: (fraction: number) => void;
}

/** A contiguous playback unit (scene clip or transition clip) */
interface Segment {
  type: "scene" | "transition";
  sceneIdx?: number;
  src: string;
  speed: number;
  videoStartOffset: number; // where in the video file to start
  videoDuration: number;    // how many video-seconds this segment spans
  wallStart: number;        // wall-clock start time
  wallEnd: number;          // wall-clock end time
}

type PlayState = "idle" | "playing" | "paused" | "done";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getVideoDuration(src: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(v.duration || 3); v.remove(); };
    v.onerror = () => { resolve(3); v.remove(); };
    v.src = src;
  });
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve();
  return new Promise((resolve) => {
    const handler = () => { video.removeEventListener("loadedmetadata", handler); resolve(); };
    video.addEventListener("loadedmetadata", handler);
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(function VideoPreview({ scenes, transitionClips, audioUrl, onProgressUpdate, onSegmentsReady, colorGrade, audioDuration: audioDurationProp }, ref) {
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [progress, setProgress] = useState(0);
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const segIdxRef = useRef(0);
  const segmentsRef = useRef<Segment[]>([]);
  const totalDurRef = useRef(0);
  const playStateRef = useRef<PlayState>("idle");
  // Stable ref for onProgressUpdate to avoid re-creating callbacks
  const onProgressRef = useRef(onProgressUpdate);
  onProgressRef.current = onProgressUpdate;
  const onSegmentsReadyRef = useRef(onSegmentsReady);
  onSegmentsReadyRef.current = onSegmentsReady;

  const playableScenes = useMemo(() => scenes.filter((s) => s.clip_url), [scenes]);
  const hasClips = playableScenes.length > 0;

  /* ---------------------------------------------------------------- */
  /*  Build segment map                                                */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function buildSegments() {
      const segs: Segment[] = [];
      let wallOffset = 0;

      for (let i = 0; i < playableScenes.length; i++) {
        if (cancelled) return;
        const scene = playableScenes[i];
        const speed = scene.speed ?? 1.0;
        // Measure actual clip file duration instead of trusting configured value
        const actualClipDur = await getVideoDuration(clipUrl(scene.clip_url!));
        const videoDuration = Math.min(actualClipDur, scene.duration); // don't exceed configured
        const wallDur = videoDuration / speed;

        segs.push({
          type: "scene",
          sceneIdx: i,
          src: clipUrl(scene.clip_url!),
          speed,
          videoStartOffset: 0,
          videoDuration,
          wallStart: wallOffset,
          wallEnd: wallOffset + wallDur,
        });
        wallOffset += wallDur;

        // Transition clip
        if (i < playableScenes.length - 1 && transitionClips) {
          const sceneNum = scene.scene_id ?? i + 1;
          const nextScene = playableScenes[i + 1];
          const nextSceneNum = nextScene.scene_id ?? i + 2;
          const transKey = `${sceneNum}_${nextSceneNum}`;
          const aiClip = transitionClips[transKey];
          if (aiClip?.clip_path) {
            if (cancelled) return;
            const transDur = await getVideoDuration(clipUrl(`/files/${aiClip.clip_path}`));
            const playableDur = Math.max(0, transDur - 0.25); // starts at 0.25
            const wallDurTrans = playableDur / 1.5;

            segs.push({
              type: "transition",
              src: clipUrl(`/files/${aiClip.clip_path}`),
              speed: 1.5,
              videoStartOffset: 0.25,
              videoDuration: playableDur,
              wallStart: wallOffset,
              wallEnd: wallOffset + wallDurTrans,
            });
            wallOffset += wallDurTrans;
          }
        }
      }

      // Use pre-measured audio duration from parent (single source of truth)
      const audioDur = audioDurationProp ?? 0;
      const total = Math.max(wallOffset, audioDur);

      if (!cancelled) {
        segmentsRef.current = segs;
        totalDurRef.current = total;
        setSegments(segs);
        setTotalDuration(total);

        // Share actual measured timings with the timeline
        onSegmentsReadyRef.current?.(
          segs.map((s) => ({ type: s.type, sceneIdx: s.sceneIdx, wallStart: s.wallStart, wallEnd: s.wallEnd })),
          total
        );

        // Preload first frame so it's not a black screen
        if (segs.length > 0 && videoRef.current) {
          const first = segs[0];
          videoRef.current.src = first.src;
          videoRef.current.currentTime = first.videoStartOffset;
        }
      }
    }

    // Reset playback when segments change
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPlayState("idle");
    playStateRef.current = "idle";
    setProgress(0);
    setCurrentSceneIdx(0);
    segIdxRef.current = 0;
    onProgressRef.current?.(null);

    buildSegments();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, transitionClips, audioUrl, audioDurationProp]);

  /* ---------------------------------------------------------------- */
  /*  Load a segment into the video element                            */
  /* ---------------------------------------------------------------- */

  const loadSegment = useCallback(async (idx: number, videoOffset = 0) => {
    const video = videoRef.current;
    const seg = segmentsRef.current[idx];
    if (!video || !seg) return;

    segIdxRef.current = idx;
    if (seg.sceneIdx != null) setCurrentSceneIdx(seg.sceneIdx);

    // Only change src if different
    const targetSrc = seg.src;
    if (video.src !== targetSrc && !video.src.endsWith(targetSrc.replace(window.location.origin, ""))) {
      video.src = targetSrc;
      await waitForMetadata(video);
    }

    video.playbackRate = seg.speed;
    video.currentTime = seg.videoStartOffset + videoOffset;
  }, []);

  /* ---------------------------------------------------------------- */
  /*  RAF tick — drives playback                                       */
  /* ---------------------------------------------------------------- */

  const tick = useCallback(() => {
    const video = videoRef.current;
    const segs = segmentsRef.current;
    const total = totalDurRef.current;
    if (!video || segs.length === 0 || total <= 0) return;

    const seg = segs[segIdxRef.current];
    if (!seg) {
      // Past all segments — check audio tail
      const audio = audioRef.current;
      if (audio && !audio.ended && !audio.paused) {
        const p = Math.min(audio.currentTime / total, 1);
        setProgress(p);
        onProgressRef.current?.(p);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setProgress(1);
        setPlayState("done");
        playStateRef.current = "done";
        onProgressRef.current?.(null);
      }
      return;
    }

    const videoElapsed = video.currentTime - seg.videoStartOffset;
    const wallElapsed = videoElapsed / seg.speed;
    const currentWall = seg.wallStart + Math.max(0, wallElapsed);

    // Update progress
    const p = Math.min(currentWall / total, 1);
    setProgress(p);
    onProgressRef.current?.(p);

    // Check if segment ended
    if (videoElapsed >= seg.videoDuration || video.ended) {
      const nextIdx = segIdxRef.current + 1;
      if (nextIdx < segs.length) {
        // Load next segment and continue playing
        const nextSeg = segs[nextIdx];
        segIdxRef.current = nextIdx;
        if (nextSeg.sceneIdx != null) setCurrentSceneIdx(nextSeg.sceneIdx);

        video.src = nextSeg.src;
        video.onloadedmetadata = () => {
          video.onloadedmetadata = null;
          video.playbackRate = nextSeg.speed;
          video.currentTime = nextSeg.videoStartOffset;
          video.play().catch(() => {});
        };
        rafRef.current = requestAnimationFrame(tick);
        return;
      } else {
        // No more video segments — audio tail or done
        video.pause();
        const audio = audioRef.current;
        if (audio && !audio.ended && !audio.paused) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        setProgress(1);
        setPlayState("done");
        playStateRef.current = "done";
        onProgressRef.current?.(null);
        return;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Playback controls                                                */
  /* ---------------------------------------------------------------- */

  const play = useCallback(async () => {
    if (!hasClips || segmentsRef.current.length === 0) return;
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (playStateRef.current === "paused") {
      // Resume from current position
      try { await video.play(); } catch { /* */ }
      if (audio && audioUrl) {
        try { await audio.play(); } catch { /* */ }
      }
      setPlayState("playing");
      playStateRef.current = "playing";
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Start from beginning
    await loadSegment(0);
    setProgress(0);

    if (audio && audioUrl) {
      audio.currentTime = 0;
      try { await audio.play(); } catch { /* */ }
    }

    try { await video.play(); } catch { /* */ }

    setPlayState("playing");
    playStateRef.current = "playing";
    onProgressRef.current?.(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [hasClips, audioUrl, tick, loadSegment]);

  const pause = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    videoRef.current?.pause();
    audioRef.current?.pause();
    setPlayState("paused");
    playStateRef.current = "paused";
    onProgressRef.current?.(null);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.removeAttribute("src"); videoRef.current.load(); }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    segIdxRef.current = 0;
    setPlayState("idle");
    playStateRef.current = "idle";
    setProgress(0);
    setCurrentSceneIdx(0);
    onProgressRef.current?.(null);
  }, []);

  const seekTo = useCallback(async (wallTime: number) => {
    const segs = segmentsRef.current;
    const total = totalDurRef.current;
    if (segs.length === 0 || total <= 0) return;

    const clamped = Math.max(0, Math.min(wallTime, total));
    const wasPlaying = playStateRef.current === "playing";

    // Find segment
    let seg = segs[segs.length - 1];
    let segIdx = segs.length - 1;
    for (let i = 0; i < segs.length; i++) {
      if (clamped < segs[i].wallEnd) {
        seg = segs[i];
        segIdx = i;
        break;
      }
    }

    // If seeking past all video segments
    if (clamped >= seg.wallEnd) {
      // Seek to end of last segment
      await loadSegment(segIdx);
      if (videoRef.current) {
        videoRef.current.currentTime = seg.videoStartOffset + Math.max(0, seg.videoDuration - 0.04);
        videoRef.current.pause();
      }
    } else {
      const wallInSeg = clamped - seg.wallStart;
      const videoOffset = wallInSeg * seg.speed;
      await loadSegment(segIdx, videoOffset);
    }

    // Sync audio
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = clamped;
    }

    // Update progress
    const p = clamped / total;
    setProgress(p);
    onProgressRef.current?.(p);

    if (wasPlaying) {
      try { await videoRef.current?.play(); } catch { /* */ }
      if (audioRef.current && audioUrl) {
        try { await audioRef.current.play(); } catch { /* */ }
      }
      setPlayState("playing");
      playStateRef.current = "playing";
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setPlayState("paused");
      playStateRef.current = "paused";
    }
  }, [audioUrl, loadSegment, tick]);

  /* ---------------------------------------------------------------- */
  /*  Imperative handle for external seek                              */
  /* ---------------------------------------------------------------- */

  useImperativeHandle(ref, () => ({
    seekTo: (wallTime: number) => seekTo(wallTime),
    seekToFraction: (fraction: number) => seekTo(fraction * totalDurRef.current),
  }), [seekTo]);

  /* ---------------------------------------------------------------- */
  /*  Progress bar click-to-seek                                       */
  /* ---------------------------------------------------------------- */

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(fraction * totalDurRef.current);
  }, [seekTo]);

  /* ---------------------------------------------------------------- */
  /*  Scene markers for progress bar                                   */
  /* ---------------------------------------------------------------- */

  const markers = useMemo(() => {
    if (totalDuration <= 0 || segments.length === 0) return [];
    // Mark each scene boundary (skip first scene start at 0)
    return segments
      .filter((s) => s.type === "scene" && s.sceneIdx != null && s.sceneIdx > 0)
      .map((s) => s.wallStart / totalDuration);
  }, [segments, totalDuration]);

  /* ---------------------------------------------------------------- */
  /*  WebGL color grading (matches ffmpeg render pipeline)              */
  /* ---------------------------------------------------------------- */

  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const hasColorGrade = !!colorGrade;

  useColorGradeGL({
    videoRef,
    canvasRef: glCanvasRef,
    colorGrade: colorGrade ?? null,
    enabled: hasColorGrade,
  });

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (!hasClips) return null;

  return (
    <div className="space-y-3">
      {/* Video player — 9:16 */}
      <div
        className="relative mx-auto bg-black rounded-lg overflow-hidden"
        style={{ aspectRatio: "9/16", maxHeight: "60vh", maxWidth: "calc(60vh * 9 / 16)" }}
      >
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-contain ${hasColorGrade ? "invisible" : ""}`}
          crossOrigin="anonymous"
          playsInline
          preload="metadata"
        />
        {/* WebGL color-graded canvas overlay */}
        {hasColorGrade && (
          <canvas
            ref={glCanvasRef}
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
        {audioUrl && <audio ref={audioRef} src={clipUrl(audioUrl)} preload="auto" />}

        {/* Play overlay removed — use the Play button below the video instead */}

        {/* Paused overlay removed — use the Play button below the video instead */}
      </div>

      {/* Progress bar — clickable for seek */}
      <div className="relative cursor-pointer" onClick={handleProgressClick}>
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
        {playState === "playing" ? (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={pause}>
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
          Scene {currentSceneIdx + 1}/{playableScenes.length}
        </span>
      </div>
    </div>
  );
});
