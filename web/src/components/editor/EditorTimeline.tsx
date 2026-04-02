"use client";

import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { Sparkles, Volume2, VolumeX } from "lucide-react";
import type { Scene, Transition } from "@/lib/api";
import { API_BASE, clipUrl, effectiveDuration } from "@/lib/api";
import { cn, BEAT_COLORS, formatDuration } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Filmstrip thumbnail — extracts frames from video and tiles them    */
/* ------------------------------------------------------------------ */

const THUMB_WIDTH = 48; // px width per thumbnail frame

function FilmstripThumbnail({ src, clipWidth, clipHeight }: { src: string; clipWidth: number; clipHeight: number }) {
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    // Only load videos from our own API server
    if (!src || (!src.startsWith(API_BASE) && !src.startsWith("/"))) return;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.src = src;

    const frameCount = Math.max(1, Math.ceil(clipWidth / THUMB_WIDTH));
    const frames: string[] = [];
    let currentFrame = 0;

    video.addEventListener("loadedmetadata", () => {
      const interval = video.duration / frameCount;
      video.currentTime = interval * 0.5; // start at half interval
    });

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Small canvas for thumbnail
      const aspect = video.videoWidth / video.videoHeight;
      canvas.height = clipHeight;
      canvas.width = Math.round(clipHeight * aspect);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.5));
      currentFrame++;

      if (currentFrame < frameCount) {
        const interval = video.duration / frameCount;
        video.currentTime = interval * (currentFrame + 0.5);
      } else {
        setThumbnails(frames);
        video.src = ""; // release
      }
    });

    return () => { video.src = ""; };
  }, [src, clipWidth, clipHeight]);

  if (thumbnails.length === 0) return null;

  return (
    <div className="absolute inset-0 flex overflow-hidden opacity-50">
      {thumbnails.map((thumb, i) => (
        <img
          key={i}
          src={thumb}
          alt=""
          className="h-full object-cover flex-shrink-0"
          style={{ width: clipWidth / thumbnails.length }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface EditorTimelineProps {
  scenes: Scene[];
  transitions: Transition[];
  selectedSceneId: string | null;
  selectedTransition?: { fromSceneId: number; toSceneId: number } | null;
  onSelectScene: (id: string) => void;
  onSelectTransition?: (fromSceneId: number, toSceneId: number) => void;
  audioMode?: string;
  audioFilename?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TARGET_VISIBLE_SECONDS = 30;
const MIN_PPS = 20;
const MAX_PPS = 80;
const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 24;
const TIMELINE_PAD = 40;

/* ------------------------------------------------------------------ */
/*  Segment layout types                                               */
/* ------------------------------------------------------------------ */

type SegmentEntry =
  | { type: "scene"; scene: Scene; idx: number; offset: number; width: number }
  | { type: "transition"; transition: Transition; offset: number; width: number };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EditorTimeline({
  scenes,
  transitions,
  selectedSceneId,
  selectedTransition,
  onSelectScene,
  onSelectTransition,
  audioMode,
  audioFilename,
}: EditorTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playheadPos, setPlayheadPos] = useState(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);

  // Measure container width for dynamic scaling
  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  const totalDuration = useMemo(() => {
    const sceneDur = scenes.reduce((sum, s) => sum + effectiveDuration(s), 0);
    const transDur = transitions.reduce((sum, t) => sum + effectiveDuration(t), 0);
    return sceneDur + transDur;
  }, [scenes, transitions]);

  // Dynamic scale: fit ~30s in view
  const pixelsPerSecond = useMemo(() => {
    const available = containerWidth - TIMELINE_PAD * 2;
    return Math.max(MIN_PPS, Math.min(MAX_PPS, available / TARGET_VISIBLE_SECONDS));
  }, [containerWidth]);

  // Build unified segment layout: scenes interleaved with transitions
  const segmentLayout = useMemo(() => {
    let offset = 0;
    const segments: SegmentEntry[] = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneWidth = effectiveDuration(scene) * pixelsPerSecond;
      segments.push({ type: "scene", scene, idx: i, offset, width: sceneWidth });
      offset += sceneWidth;

      // Insert transition after scene (if not last)
      if (i < scenes.length - 1) {
        const sceneNum = scene.scene_id ?? i + 1;
        const trans = transitions.find((t) => t.from_scene_id === sceneNum);
        if (trans && trans.duration > 0) {
          const transWidth = effectiveDuration(trans) * pixelsPerSecond;
          segments.push({ type: "transition", transition: trans, offset, width: transWidth });
          offset += transWidth;
        }
      }
    }

    return segments;
  }, [scenes, transitions, pixelsPerSecond]);

  const totalWidth = totalDuration * pixelsPerSecond;

  // Scene-only layout for audio track alignment
  const sceneLayout = useMemo(
    () => segmentLayout.filter((s): s is Extract<SegmentEntry, { type: "scene" }> => s.type === "scene"),
    [segmentLayout]
  );

  // Time ruler ticks
  const ticks = useMemo(() => {
    const result: Array<{ time: number; x: number; major: boolean }> = [];
    for (let t = 0; t <= totalDuration; t += 1) {
      result.push({
        time: t,
        x: t * pixelsPerSecond,
        major: t % 5 === 0,
      });
    }
    return result;
  }, [totalDuration, pixelsPerSecond]);

  // Playhead drag
  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft - TIMELINE_PAD;
      setPlayheadPos(Math.max(0, Math.min(x, totalWidth)));
      setIsDraggingPlayhead(true);
    },
    [totalWidth]
  );

  useEffect(() => {
    if (!isDraggingPlayhead) return;
    const handleMove = (e: MouseEvent) => {
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft - TIMELINE_PAD;
      setPlayheadPos(Math.max(0, Math.min(x, totalWidth)));
    };
    const handleUp = () => setIsDraggingPlayhead(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingPlayhead, totalWidth]);

  // Scroll to selected scene
  useEffect(() => {
    if (!selectedSceneId || !scrollRef.current) return;
    const layout = sceneLayout.find((l) => l.scene.id === selectedSceneId);
    if (!layout) return;
    const container = scrollRef.current;
    const sceneCenter = layout.offset + layout.width / 2;
    const containerCenter = container.clientWidth / 2;
    container.scrollTo({
      left: sceneCenter - containerCenter,
      behavior: "smooth",
    });
  }, [selectedSceneId, sceneLayout]);

  const playheadTime = totalWidth > 0 ? (playheadPos / totalWidth) * totalDuration : 0;

  if (scenes.length === 0) {
    return (
      <div className="h-[180px] flex-shrink-0 border-t border-slate-800 bg-slate-950 flex items-center justify-center">
        <span className="text-sm text-slate-500">No scenes in this project</span>
      </div>
    );
  }

  return (
    <div className="h-[180px] flex-shrink-0 border-t border-slate-800 bg-slate-950 flex flex-col">
      {/* Timecode display */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-slate-800/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
            Timeline
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-amber-400">
            {formatDuration(playheadTime)}
          </span>
          <span className="text-xs text-slate-600">/</span>
          <span className="text-xs font-mono text-slate-400">
            {formatDuration(totalDuration)}
          </span>
        </div>
      </div>

      {/* Scrollable tracks area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        style={{ minHeight: 0 }}
      >
        <div
          className="relative"
          style={{ width: totalWidth + TIMELINE_PAD * 2, minWidth: "100%" }}
        >
          {/* Time ruler */}
          <div
            className="relative bg-slate-900/80 border-b border-slate-800/50 select-none cursor-crosshair"
            style={{ height: RULER_HEIGHT }}
            onMouseDown={handleRulerMouseDown}
          >
            {ticks.map((tick) => (
              <div
                key={tick.time}
                className="absolute top-0"
                style={{ left: tick.x + TIMELINE_PAD }}
              >
                <div
                  className={cn(
                    "w-px",
                    tick.major
                      ? "h-3 bg-slate-500"
                      : "h-2 bg-slate-700"
                  )}
                />
                {tick.major && (
                  <span className="absolute top-3 -translate-x-1/2 text-[9px] text-slate-500 font-mono">
                    {formatDuration(tick.time)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Video track */}
          <div
            className="relative flex items-center"
            style={{ height: TRACK_HEIGHT }}
          >
            {segmentLayout.map((entry) => {
              if (entry.type === "scene") {
                const { scene, idx, offset, width } = entry;
                const sceneNum = scene.scene_id ?? idx + 1;
                const isSelected = scene.id === selectedSceneId;

                return (
                  <button
                    key={`scene-${scene.id}`}
                    type="button"
                    onClick={() => onSelectScene(scene.id)}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md overflow-hidden border transition-all group cursor-pointer",
                      isSelected
                        ? "border-amber-500 ring-1 ring-amber-500/30 z-10"
                        : "border-slate-700 hover:border-slate-500"
                    )}
                    style={{
                      left: offset + TIMELINE_PAD,
                      width: Math.max(width - 2, 24),
                    }}
                  >
                    {/* Amber tint when selected */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-amber-500/20 z-[1]" />
                    )}

                    {/* Filmstrip thumbnail or beat color fallback */}
                    {scene.clip_url ? (
                      <FilmstripThumbnail
                        src={clipUrl(scene.clip_url)}
                        clipWidth={Math.max(width - 2, 24)}
                        clipHeight={TRACK_HEIGHT - 8}
                      />
                    ) : (scene.keyframe_path || scene.keyframe_url) ? (
                      <div className="absolute inset-0 overflow-hidden opacity-50">
                        <img src={scene.keyframe_path ? clipUrl(`/files/${scene.keyframe_path}`) : scene.keyframe_url!} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={cn("absolute inset-0 opacity-30", BEAT_COLORS[scene.beat])} />
                    )}

                    {/* Label */}
                    <div className="relative z-10 flex items-center gap-1.5 px-2 h-full">
                      <span className="text-[10px] font-bold text-white/80">
                        {sceneNum}
                      </span>

                      {width > 50 && (
                        <span className="text-[9px] text-white/40 font-mono ml-auto">
                          {formatDuration(effectiveDuration(scene))}
                        </span>
                      )}
                    </div>

                    {/* Speed badge */}
                    {scene.speed && scene.speed !== 1.0 && (
                      <div className="absolute top-0.5 right-1 text-[8px] font-mono text-cyan-400 bg-cyan-500/20 rounded px-0.5">
                        {scene.speed}x
                      </div>
                    )}

                    {/* Clip status indicator */}
                    {scene.clip_url && (
                      <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                    {!scene.clip_url && (scene.keyframe_path || scene.keyframe_url) && (
                      <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              } else {
                // Transition segment
                const { transition, offset, width } = entry;
                const transKey = `${transition.from_scene_id}_${transition.to_scene_id}`;
                const hasClip = !!transition.clip_path;
                const isTransSelected =
                  selectedTransition?.fromSceneId === transition.from_scene_id &&
                  selectedTransition?.toSceneId === transition.to_scene_id;

                return (
                  <button
                    key={`trans-${transKey}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTransition?.(transition.from_scene_id, transition.to_scene_id);
                    }}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md border-2 transition-all flex items-center justify-center overflow-hidden cursor-pointer",
                      isTransSelected
                        ? "border-amber-400 bg-gradient-to-b from-amber-500/30 to-amber-600/20 ring-1 ring-amber-500/30 z-20"
                        : hasClip
                        ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/20 to-emerald-600/10 z-10 hover:border-emerald-400"
                        : "border-dashed border-slate-500 bg-slate-700/40 z-10 hover:border-slate-400 hover:bg-slate-600/40"
                    )}
                    style={{
                      left: offset + TIMELINE_PAD,
                      width: Math.max(width - 2, 24),
                    }}
                    title={`Transition: Scene ${transition.from_scene_id} → ${transition.to_scene_id}`}
                  >
                    {hasClip ? (
                      <FilmstripThumbnail
                        src={clipUrl(`/files/${transition.clip_path}`)}
                        clipWidth={Math.max(width - 2, 24)}
                        clipHeight={TRACK_HEIGHT - 8}
                      />
                    ) : (
                      <Sparkles className="w-3 h-3 text-slate-500" />
                    )}

                    {/* Duration label */}
                    {width > 40 && (
                      <span className="absolute bottom-0.5 right-1 text-[8px] text-white/40 font-mono">
                        {formatDuration(effectiveDuration(transition))}
                      </span>
                    )}

                    {/* Speed badge */}
                    {transition.speed !== 1.0 && (
                      <div className="absolute top-0.5 right-1 text-[8px] font-mono text-cyan-400 bg-cyan-500/20 rounded px-0.5">
                        {transition.speed}x
                      </div>
                    )}
                  </button>
                );
              }
            })}
          </div>

          {/* Audio track */}
          <div
            className="relative border-t border-slate-800/50"
            style={{ height: 32 }}
          >
            {(audioMode === "uploaded" || audioMode === "upload") && audioFilename ? (
              <div
                className="absolute top-1 bottom-1 rounded bg-indigo-500/20 border border-indigo-500/30 flex items-center px-2 gap-1.5"
                style={{ left: TIMELINE_PAD, width: totalWidth }}
              >
                <Volume2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                <span className="text-[10px] text-indigo-300 truncate">
                  {audioFilename}
                </span>
              </div>
            ) : audioMode === "narration" ? (
              /* Per-scene narration segments */
              sceneLayout.map(({ scene, offset, width }) => (
                <div
                  key={`nar-${scene.id}`}
                  className="absolute top-1 bottom-1 rounded bg-violet-500/15 border border-violet-500/20"
                  style={{ left: offset + TIMELINE_PAD, width: Math.max(width - 2, 8) }}
                >
                  <span className="text-[9px] text-violet-400 px-1 truncate block leading-[24px]">
                    Narration
                  </span>
                </div>
              ))
            ) : audioMode === "auto" ? (
              <div
                className="absolute top-1 bottom-1 rounded bg-slate-800/50 border border-slate-700/30 flex items-center px-2"
                style={{ left: TIMELINE_PAD, width: totalWidth }}
              >
                <span className="text-[10px] text-slate-500">Auto-generated audio</span>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ paddingLeft: TIMELINE_PAD }}>
                <div className="flex items-center gap-1.5">
                  <VolumeX className="w-3 h-3 text-slate-600" />
                  <span className="text-[10px] text-slate-600">No audio</span>
                </div>
              </div>
            )}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-amber-500 pointer-events-none z-30"
            style={{ left: playheadPos + TIMELINE_PAD }}
          >
            {/* Playhead handle */}
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2.5 h-3 bg-amber-500 rounded-b-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
