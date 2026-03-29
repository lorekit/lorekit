"use client";

import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { Diamond, Volume2, VolumeX } from "lucide-react";
import type { Scene } from "@/lib/api";
import { clipUrl } from "@/lib/api";
import { cn, BEAT_COLORS, formatDuration } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Transition pill map (shared with LeftPanel)                       */
/* ------------------------------------------------------------------ */

export const TRANSITION_PILLS: Array<{ key: string; label: string }> = [
  { key: "circle_close", label: "Circle Close" },
  { key: "circle_open", label: "Circle Open" },
  { key: "coverleft", label: "Cover Left" },
  { key: "coverright", label: "Cover Right" },
  { key: "dissolve", label: "Dissolve" },
  { key: "fade", label: "Fade" },
  { key: "fade_to_black", label: "Fade to Black" },
  { key: "fast_fade", label: "Fast Fade" },
  { key: "flash", label: "Flash" },
  { key: "hard_cut", label: "Hard Cut" },
  { key: "pixelize", label: "Pixelize" },
  { key: "radial", label: "Radial" },
  { key: "slide_down", label: "Slide Down" },
  { key: "slide_left", label: "Slide Left" },
  { key: "slide_right", label: "Slide Right" },
  { key: "slide_up", label: "Slide Up" },
  { key: "slow_fade", label: "Slow Fade" },
  { key: "windleft", label: "Wind Left" },
  { key: "windright", label: "Wind Right" },
  { key: "zoom_in", label: "Zoom In" },
];

const PILL_LABEL_MAP = Object.fromEntries(
  TRANSITION_PILLS.map((p) => [p.key, p.label])
);

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface EditorTimelineProps {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
  transitions: Record<number, string>;
  onTransitionChange: (sceneId: number, transition: string) => void;
  audioMode?: string;
  audioFilename?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PIXELS_PER_SECOND = 80;
const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 24;
const TRANSITION_WIDTH = 20;
const TIMELINE_PAD = 40;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EditorTimeline({
  scenes,
  selectedSceneId,
  onSelectScene,
  transitions,
  onTransitionChange,
  audioMode,
  audioFilename,
}: EditorTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playheadPos, setPlayheadPos] = useState(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [openTransitionPicker, setOpenTransitionPicker] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const totalDuration = useMemo(
    () => scenes.reduce((sum, s) => sum + s.duration, 0),
    [scenes]
  );

  const totalWidth = totalDuration * PIXELS_PER_SECOND;

  // Build scene layout: cumulative offsets
  const sceneLayout = useMemo(() => {
    let offset = 0;
    return scenes.map((scene, idx) => {
      const width = scene.duration * PIXELS_PER_SECOND;
      const entry = { scene, idx, offset, width };
      offset += width;
      return entry;
    });
  }, [scenes]);

  // Time ruler ticks
  const ticks = useMemo(() => {
    const result: Array<{ time: number; x: number; major: boolean }> = [];
    for (let t = 0; t <= totalDuration; t += 1) {
      result.push({
        time: t,
        x: t * PIXELS_PER_SECOND,
        major: t % 5 === 0,
      });
    }
    return result;
  }, [totalDuration]);

  // Close transition picker on outside click
  useEffect(() => {
    if (openTransitionPicker === null) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenTransitionPicker(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openTransitionPicker]);

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

            {sceneLayout.map(({ scene, idx, offset, width }) => {
              const sceneNum = scene.scene_id ?? idx + 1;
              const isSelected = scene.id === selectedSceneId;
              const isLast = idx === scenes.length - 1;
              const currentTransition = transitions[sceneNum] || "fade";

              return (
                <React.Fragment key={scene.id}>
                  {/* Scene clip block */}
                  <button
                    type="button"
                    onClick={() => onSelectScene(scene.id)}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md overflow-hidden border transition-all group",
                      isSelected
                        ? "border-amber-500 ring-1 ring-amber-500/30 z-10"
                        : "border-slate-700 hover:border-slate-500"
                    )}
                    style={{
                      left: offset + TIMELINE_PAD,
                      width: Math.max(width - 2, 24),
                    }}
                  >
                    {/* Background with beat color */}
                    <div
                      className={cn(
                        "absolute inset-0 opacity-30",
                        BEAT_COLORS[scene.beat]
                      )}
                    />

                    {/* Thumbnail */}
                    {(scene.keyframe_url || scene.clip_url) && (
                      <div className="absolute left-0 top-0 bottom-0 w-12 overflow-hidden">
                        {scene.keyframe_url ? (
                          <img
                            src={scene.keyframe_url}
                            alt=""
                            className="w-full h-full object-cover opacity-60"
                          />
                        ) : scene.clip_url ? (
                          <video
                            src={clipUrl(scene.clip_url)}
                            className="w-full h-full object-cover opacity-60"
                            muted
                            preload="metadata"
                          />
                        ) : null}
                      </div>
                    )}

                    {/* Label */}
                    <div className="relative z-10 flex items-center gap-1.5 px-2 h-full">
                      <span className="text-[10px] font-bold text-white/80">
                        {sceneNum}
                      </span>

                      {width > 100 && (
                        <span className="text-[9px] text-white/40 font-mono ml-auto">
                          {formatDuration(scene.duration)}
                        </span>
                      )}
                    </div>

                    {/* Clip status indicator */}
                    {scene.clip_url && (
                      <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                    {!scene.clip_url && scene.keyframe_url && (
                      <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>

                  {/* Transition indicator between clips */}
                  {!isLast && (
                    <div
                      className="absolute top-1 bottom-1 flex items-center justify-center z-20"
                      style={{
                        left: offset + width + TIMELINE_PAD - TRANSITION_WIDTH / 2,
                        width: TRANSITION_WIDTH,
                      }}
                    >
                      <button
                        type="button"
                        ref={(el) => { chipRefs.current[sceneNum] = el; }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTransitionPicker(
                            openTransitionPicker === sceneNum ? null : sceneNum
                          );
                        }}
                        className={cn(
                          "w-4 h-4 rounded-sm rotate-45 border transition-colors",
                          openTransitionPicker === sceneNum
                            ? "border-amber-500 bg-amber-500/30"
                            : "border-slate-500 bg-slate-700 hover:bg-slate-600"
                        )}
                        title={`Transition: ${PILL_LABEL_MAP[currentTransition] || currentTransition}`}
                      />

                      {/* Transition picker popover */}
                      {openTransitionPicker === sceneNum && (() => {
                        const rect = chipRefs.current[sceneNum]?.getBoundingClientRect();
                        const style = rect
                          ? {
                              position: "fixed" as const,
                              left: Math.max(8, rect.left - 120),
                              bottom: window.innerHeight - rect.top + 8,
                              zIndex: 9999,
                            }
                          : {};
                        return (
                          <div
                            ref={pickerRef}
                            className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 w-[260px]"
                            style={style}
                          >
                            <p className="text-[10px] text-slate-400 mb-1.5 px-1">
                              Scene {sceneNum} → {sceneNum + 1}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {TRANSITION_PILLS.map(({ key, label }) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    onTransitionChange(sceneNum, key);
                                    setOpenTransitionPicker(null);
                                  }}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                                    currentTransition === key
                                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                                      : "border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500"
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </React.Fragment>
              );
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
