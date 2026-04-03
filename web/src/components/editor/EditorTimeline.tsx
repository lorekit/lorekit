"use client";

import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { Sparkles, Volume2, VolumeX, Palette } from "lucide-react";
import type { Scene, Transition } from "@/lib/api";
import { API_BASE, clipUrl, effectiveDuration } from "@/lib/api";
import type { SegmentTiming } from "@/components/editor/VideoPreview";
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
  /** Duration of uploaded audio in seconds */
  audioDuration?: number;
  /** External playback progress 0-1 fraction, null = not playing */
  playbackProgress?: number | null;
  /** Called when user clicks/drags the ruler (fraction 0-1) */
  onPlayheadSeek?: (fraction: number) => void;
  /** Actual measured segment timings from video player */
  actualSegments?: SegmentTiming[];
  /** Actual total duration measured from video files */
  actualTotalDuration?: number;
  /** Called when a scene's speed is changed via edge drag */
  onUpdateScene?: (sceneId: string, updates: Partial<Scene>) => void;
  /** Called when a transition's speed is changed via edge drag */
  onUpdateTransition?: (fromSceneId: number, toSceneId: number, updates: Partial<Transition>) => void;
  /** Whether color grading is enabled (shows filter track) */
  colorGradeEnabled?: boolean;
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
const EDGE_HANDLE_WIDTH = 6; // px
const MIN_SPEED = 0.25;
const MAX_SPEED = 4.0;
const SNAP_THRESHOLD = 8; // px — magnetize within this distance

/* ------------------------------------------------------------------ */
/*  Segment layout types                                               */
/* ------------------------------------------------------------------ */

type SegmentEntry =
  | { type: "scene"; scene: Scene; idx: number; offset: number; width: number }
  | { type: "transition"; transition: Transition; offset: number; width: number };

/* ------------------------------------------------------------------ */
/*  Edge drag state                                                    */
/* ------------------------------------------------------------------ */

interface EdgeDragState {
  segmentIndex: number;
  edge: "left" | "right";
  startX: number;
  originalWidth: number;
  /** The clip's file duration (used to compute new speed) */
  clipDuration: number;
  /** The clip's offset in pixels (for snap point calculation) */
  segmentOffset: number;
}

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
  audioDuration: audioDurationProp,
  playbackProgress,
  onPlayheadSeek,
  actualSegments,
  actualTotalDuration,
  onUpdateScene,
  onUpdateTransition,
  colorGradeEnabled,
}: EditorTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playheadPos, setPlayheadPos] = useState(0);
  const playheadPosRef = useRef(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);

  // Edge drag state
  const [edgeDrag, setEdgeDrag] = useState<EdgeDragState | null>(null);
  const [edgeDragDelta, setEdgeDragDelta] = useState(0);
  const edgeDragRef = useRef<EdgeDragState | null>(null);
  const edgeDragDeltaRef = useRef(0);
  // Track if we're in an edge drag to suppress click events
  const wasEdgeDragging = useRef(false);
  // Snap guide line position (pixels from left, null when not snapping)
  const [snapGuidePos, setSnapGuidePos] = useState<number | null>(null);

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
    // Use actual measured duration from video player when available
    if (actualTotalDuration != null && actualTotalDuration > 0) {
      return Math.max(actualTotalDuration, audioDurationProp ?? 0);
    }
    const sceneDur = scenes.reduce((sum, s) => sum + effectiveDuration(s), 0);
    const transDur = transitions.reduce((sum, t) => sum + effectiveDuration(t), 0);
    const videoDur = sceneDur + transDur;
    return Math.max(videoDur, audioDurationProp ?? 0);
  }, [scenes, transitions, audioDurationProp, actualTotalDuration]);

  // Dynamic scale: fit ~30s in view
  const pixelsPerSecond = useMemo(() => {
    const available = containerWidth - TIMELINE_PAD * 2;
    return Math.max(MIN_PPS, Math.min(MAX_PPS, available / TARGET_VISIBLE_SECONDS));
  }, [containerWidth]);

  // Build unified segment layout: scenes interleaved with transitions
  // Uses actual measured durations from video player when available
  const segmentLayout = useMemo(() => {
    let offset = 0;
    const segments: SegmentEntry[] = [];

    // Build a lookup from actualSegments for fast access
    // actualSegments are ordered: scene0, trans0-1, scene1, trans1-2, ...
    let actualIdx = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // Try to get actual duration from measured segments
      let sceneDur = effectiveDuration(scene);
      if (actualSegments && actualIdx < actualSegments.length) {
        const as = actualSegments[actualIdx];
        if (as.type === "scene" && as.sceneIdx === i) {
          sceneDur = as.wallEnd - as.wallStart;
          actualIdx++;
        }
      }

      const sceneWidth = sceneDur * pixelsPerSecond;
      segments.push({ type: "scene", scene, idx: i, offset, width: sceneWidth });
      offset += sceneWidth;

      // Insert transition after scene (if not last)
      if (i < scenes.length - 1) {
        const sceneNum = scene.scene_id ?? i + 1;
        const trans = transitions.find((t) => t.from_scene_id === sceneNum);
        if (trans && trans.duration > 0) {
          // Try to get actual duration from measured segments
          let transDur = effectiveDuration(trans);
          if (actualSegments && actualIdx < actualSegments.length) {
            const as = actualSegments[actualIdx];
            if (as.type === "transition") {
              transDur = as.wallEnd - as.wallStart;
              actualIdx++;
            }
          }

          const transWidth = transDur * pixelsPerSecond;
          segments.push({ type: "transition", transition: trans, offset, width: transWidth });
          offset += transWidth;
        }
      }
    }

    return segments;
  }, [scenes, transitions, pixelsPerSecond, actualSegments]);

  const totalWidth = totalDuration * pixelsPerSecond;

  // Snap points for edge drag (in pixels)
  const snapPoints = useMemo(() => {
    const points: number[] = [];
    // Audio track end
    if (audioDurationProp && audioDurationProp > 0) {
      points.push(audioDurationProp * pixelsPerSecond);
    }
    // All segment edges (excluding the segment being dragged — filtered at drag time)
    for (const seg of segmentLayout) {
      points.push(seg.offset);
      points.push(seg.offset + seg.width);
    }
    return [...new Set(points)]; // deduplicate
  }, [audioDurationProp, pixelsPerSecond, segmentLayout]);

  // Scene-only layout for audio track alignment
  const sceneLayout = useMemo(
    () => segmentLayout.filter((s): s is Extract<SegmentEntry, { type: "scene" }> => s.type === "scene"),
    [segmentLayout]
  );

  // Sync playhead from external playback progress (0-1 fraction)
  useEffect(() => {
    if (playbackProgress != null && !isDraggingPlayhead) {
      setPlayheadPos(Math.max(0, Math.min(playbackProgress * totalWidth, totalWidth)));
    }
  }, [playbackProgress, totalWidth, isDraggingPlayhead]);

  // Time ruler ticks
  const ticks = useMemo(() => {
    const lastTick = Math.floor(totalDuration);
    const result: Array<{ time: number; x: number; major: boolean }> = [];
    for (let t = 0; t <= lastTick; t += 1) {
      result.push({
        time: t,
        x: t * pixelsPerSecond,
        major: t % 5 === 0 || t === lastTick, // label every 5s and the last tick
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
      const pos = Math.max(0, Math.min(x, totalWidth));
      playheadPosRef.current = pos;
      setPlayheadPos(pos);
      setIsDraggingPlayhead(true);
      queueMicrotask(() => onPlayheadSeek?.(totalWidth > 0 ? pos / totalWidth : 0));
    },
    [totalWidth, onPlayheadSeek]
  );

  useEffect(() => {
    if (!isDraggingPlayhead) return;
    const handleMove = (e: MouseEvent) => {
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const pos = Math.max(0, Math.min(e.clientX - rect.left + scrollLeft - TIMELINE_PAD, totalWidth));
      playheadPosRef.current = pos;
      setPlayheadPos(pos);
    };
    const handleUp = () => {
      setIsDraggingPlayhead(false);
      if (totalWidth > 0) {
        queueMicrotask(() => onPlayheadSeek?.(playheadPosRef.current / totalWidth));
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingPlayhead, totalWidth]);

  /* ---------------------------------------------------------------- */
  /*  Edge drag — resize clips to adjust speed                         */
  /* ---------------------------------------------------------------- */

  const handleEdgeMouseDown = useCallback(
    (e: React.MouseEvent, segmentIndex: number, edge: "left" | "right") => {
      e.preventDefault();
      e.stopPropagation();

      const entry = segmentLayout[segmentIndex];
      if (!entry) return;

      // Get the clip's file duration (what was sent to Kling)
      const clipDuration = entry.type === "scene" ? entry.scene.duration : entry.transition.duration;

      const state: EdgeDragState = {
        segmentIndex,
        edge,
        startX: e.clientX,
        originalWidth: entry.width,
        clipDuration,
        segmentOffset: entry.offset,
      };
      edgeDragRef.current = state;
      edgeDragDeltaRef.current = 0;
      setEdgeDrag(state);
      setEdgeDragDelta(0);
      wasEdgeDragging.current = true;
    },
    [segmentLayout]
  );

  useEffect(() => {
    if (!edgeDrag) return;

    const handleMove = (e: MouseEvent) => {
      const drag = edgeDragRef.current;
      if (!drag) return;

      let delta = e.clientX - drag.startX;
      if (drag.edge === "left") delta = -delta; // left edge: drag left = grow

      // Clamp to speed limits
      const minWidth = (drag.clipDuration / MAX_SPEED) * pixelsPerSecond;
      const maxWidth = (drag.clipDuration / MIN_SPEED) * pixelsPerSecond;
      let newWidth = Math.max(minWidth, Math.min(maxWidth, drag.originalWidth + delta));

      // Snap: compute the position of the dragged edge
      const draggedEdgePos = drag.edge === "right"
        ? drag.segmentOffset + newWidth
        : drag.segmentOffset + drag.originalWidth - newWidth; // left edge moves

      // Find nearest snap point (exclude the segment's own edges)
      const ownLeft = drag.segmentOffset;
      const ownRight = drag.segmentOffset + drag.originalWidth;
      let snapped: number | null = null;
      let bestDist = SNAP_THRESHOLD;
      for (const sp of snapPoints) {
        // Skip the segment's own original edges
        if (Math.abs(sp - ownLeft) < 1 || Math.abs(sp - ownRight) < 1) continue;
        const dist = Math.abs(draggedEdgePos - sp);
        if (dist < bestDist) {
          bestDist = dist;
          snapped = sp;
        }
      }

      if (snapped != null) {
        // Snap: adjust newWidth so the edge aligns with the snap point
        if (drag.edge === "right") {
          newWidth = snapped - drag.segmentOffset;
        } else {
          newWidth = (drag.segmentOffset + drag.originalWidth) - snapped;
        }
        // Re-clamp after snap
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        setSnapGuidePos(snapped);
      } else {
        setSnapGuidePos(null);
      }

      const clampedDelta = newWidth - drag.originalWidth;
      edgeDragDeltaRef.current = clampedDelta;
      setEdgeDragDelta(clampedDelta);
    };

    const handleUp = () => {
      const drag = edgeDragRef.current;
      const delta = edgeDragDeltaRef.current;

      if (drag && Math.abs(delta) > 2) {
        const newWidth = drag.originalWidth + delta;
        const newEffectiveDur = newWidth / pixelsPerSecond;
        const newSpeed = Math.round((drag.clipDuration / newEffectiveDur) * 100) / 100;
        const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, newSpeed));

        const entry = segmentLayout[drag.segmentIndex];
        if (entry?.type === "scene") {
          onUpdateScene?.(entry.scene.id, { speed: clampedSpeed });
        } else if (entry?.type === "transition") {
          onUpdateTransition?.(entry.transition.from_scene_id, entry.transition.to_scene_id, { speed: clampedSpeed });
        }
      }

      edgeDragRef.current = null;
      edgeDragDeltaRef.current = 0;
      setEdgeDrag(null);
      setEdgeDragDelta(0);
      setSnapGuidePos(null);

      // Prevent the click event that follows mouseup from selecting the clip
      setTimeout(() => { wasEdgeDragging.current = false; }, 50);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [edgeDrag, pixelsPerSecond, segmentLayout, onUpdateScene, onUpdateTransition]);

  // Compute the preview speed during drag
  const dragPreviewSpeed = useMemo(() => {
    if (!edgeDrag || Math.abs(edgeDragDelta) < 1) return null;
    const newWidth = edgeDrag.originalWidth + edgeDragDelta;
    const newEffectiveDur = newWidth / pixelsPerSecond;
    const speed = edgeDrag.clipDuration / newEffectiveDur;
    return Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(speed * 100) / 100));
  }, [edgeDrag, edgeDragDelta, pixelsPerSecond]);

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

  const displayPlayheadTime = totalWidth > 0 ? (playheadPos / totalWidth) * totalDuration : 0;

  /* ---------------------------------------------------------------- */
  /*  Helper: compute visual width/offset for a segment during drag    */
  /* ---------------------------------------------------------------- */

  function getSegmentVisuals(segIdx: number, baseOffset: number, baseWidth: number) {
    if (!edgeDrag || edgeDrag.segmentIndex !== segIdx) {
      return { offset: baseOffset, width: baseWidth };
    }
    const newWidth = baseWidth + edgeDragDelta;
    if (edgeDrag.edge === "left") {
      return { offset: baseOffset - edgeDragDelta, width: newWidth };
    }
    return { offset: baseOffset, width: newWidth };
  }

  /* ---------------------------------------------------------------- */
  /*  Helper: render edge handles for a clip                           */
  /* ---------------------------------------------------------------- */

  function renderEdgeHandles(segIdx: number) {
    return (
      <>
        {/* Left edge handle */}
        <div
          className="absolute top-0 bottom-0 left-0 z-20 cursor-col-resize group/edge"
          style={{ width: EDGE_HANDLE_WIDTH }}
          onMouseDown={(e) => handleEdgeMouseDown(e, segIdx, "left")}
        >
          <div className="absolute inset-y-1 left-0 w-[2px] bg-amber-500 opacity-0 group-hover/edge:opacity-100 transition-opacity rounded-full" />
        </div>
        {/* Right edge handle */}
        <div
          className="absolute top-0 bottom-0 right-0 z-20 cursor-col-resize group/edge"
          style={{ width: EDGE_HANDLE_WIDTH }}
          onMouseDown={(e) => handleEdgeMouseDown(e, segIdx, "right")}
        >
          <div className="absolute inset-y-1 right-0 w-[2px] bg-amber-500 opacity-0 group-hover/edge:opacity-100 transition-opacity rounded-full" />
        </div>
      </>
    );
  }

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
            {formatDuration(displayPlayheadTime)}
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
            {segmentLayout.map((entry, segIdx) => {
              if (entry.type === "scene") {
                const { scene, idx, offset: baseOffset, width: baseWidth } = entry;
                const isSelected = scene.id === selectedSceneId;
                const isDragging = edgeDrag?.segmentIndex === segIdx;
                const { offset, width } = getSegmentVisuals(segIdx, baseOffset, baseWidth);
                const displaySpeed = isDragging && dragPreviewSpeed != null ? dragPreviewSpeed : (scene.speed ?? 1.0);

                return (
                  <div
                    key={`scene-${scene.id}`}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md overflow-hidden border group cursor-pointer",
                      isDragging
                        ? "border-amber-400 ring-1 ring-amber-400/40 z-20"
                        : isSelected
                        ? "border-amber-500 ring-1 ring-amber-500/30 z-10"
                        : "border-slate-700 hover:border-slate-500"
                    )}
                    style={{
                      left: offset + TIMELINE_PAD,
                      width: Math.max(width - 2, 24),
                    }}
                    onClick={() => {
                      if (wasEdgeDragging.current) return;
                      onSelectScene(scene.id);
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

                    {/* Duration label */}
                    <div className="relative z-10 flex items-center px-2 h-full">
                      {width > 50 && (
                        <span className="text-[9px] text-white/40 font-mono ml-auto">
                          {formatDuration(width / pixelsPerSecond)}
                        </span>
                      )}
                    </div>

                    {/* Speed badge */}
                    {displaySpeed !== 1.0 && (
                      <div className={cn(
                        "absolute top-0.5 right-1 text-[8px] font-mono rounded px-0.5",
                        isDragging
                          ? "text-amber-300 bg-amber-500/30"
                          : "text-cyan-400 bg-cyan-500/20"
                      )}>
                        {displaySpeed}x
                      </div>
                    )}

                    {/* Clip status indicator */}
                    {scene.clip_url && (
                      <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                    {!scene.clip_url && (scene.keyframe_path || scene.keyframe_url) && (
                      <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}

                    {/* Edge drag handles */}
                    {renderEdgeHandles(segIdx)}
                  </div>
                );
              } else {
                // Transition segment
                const { transition, offset: baseOffset, width: baseWidth } = entry;
                const transKey = `${transition.from_scene_id}_${transition.to_scene_id}`;
                const hasClip = !!transition.clip_path;
                const isTransSelected =
                  selectedTransition?.fromSceneId === transition.from_scene_id &&
                  selectedTransition?.toSceneId === transition.to_scene_id;
                const isDragging = edgeDrag?.segmentIndex === segIdx;
                const { offset, width } = getSegmentVisuals(segIdx, baseOffset, baseWidth);
                const displaySpeed = isDragging && dragPreviewSpeed != null ? dragPreviewSpeed : transition.speed;

                return (
                  <div
                    key={`trans-${transKey}`}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md border-2 flex items-center justify-center overflow-hidden cursor-pointer",
                      isDragging
                        ? "border-amber-400 bg-gradient-to-b from-amber-500/30 to-amber-600/20 ring-1 ring-amber-400/40 z-20"
                        : isTransSelected
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
                    onClick={(e) => {
                      if (wasEdgeDragging.current) return;
                      e.stopPropagation();
                      onSelectTransition?.(transition.from_scene_id, transition.to_scene_id);
                    }}
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
                        {formatDuration(width / pixelsPerSecond)}
                      </span>
                    )}

                    {/* Speed badge */}
                    {displaySpeed !== 1.0 && (
                      <div className={cn(
                        "absolute top-0.5 right-1 text-[8px] font-mono rounded px-0.5",
                        isDragging
                          ? "text-amber-300 bg-amber-500/30"
                          : "text-cyan-400 bg-cyan-500/20"
                      )}>
                        {displaySpeed}x
                      </div>
                    )}

                    {/* Edge drag handles */}
                    {renderEdgeHandles(segIdx)}
                  </div>
                );
              }
            })}
          </div>

          {/* Filter track — shown when color grading is enabled */}
          {colorGradeEnabled && (
            <div
              className="relative border-t border-slate-800/50"
              style={{ height: 24 }}
            >
              <div
                className="absolute top-0.5 bottom-0.5 rounded bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-500/30 flex items-center px-2 gap-1.5"
                style={{ left: TIMELINE_PAD, width: totalWidth }}
              >
                <Palette className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="text-[9px] text-amber-300/80 font-medium">Color Grading</span>
              </div>
            </div>
          )}

          {/* Audio track */}
          <div
            className="relative border-t border-slate-800/50"
            style={{ height: 32 }}
          >
            {(audioMode === "uploaded" || audioMode === "upload") && audioFilename ? (
              <div
                className="absolute top-1 bottom-1 rounded bg-indigo-500/20 border border-indigo-500/30 flex items-center px-2 gap-1.5"
                style={{ left: TIMELINE_PAD, width: (audioDurationProp ?? totalDuration) * pixelsPerSecond }}
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

          {/* Snap guide line */}
          {snapGuidePos != null && (
            <div
              className="absolute top-0 bottom-0 w-px pointer-events-none z-30"
              style={{
                left: snapGuidePos + TIMELINE_PAD,
                borderLeft: "1px dashed rgb(245 158 11 / 0.7)",
              }}
            />
          )}

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
