"use client";

import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { Sparkles, Volume2, VolumeX, Palette, Type } from "lucide-react";
import type { Scene, Transition, TextItem } from "@/lib/api";
import { clipUrl, effectiveDuration } from "@/lib/api";
import type { SegmentTiming } from "@/components/editor/VideoPreview";
import { cn, BEAT_COLORS, formatDuration } from "@/lib/utils";
import { FilmstripThumbnail } from "./FilmstripThumbnail";
import { useEdgeDrag, useReorderDrag, useTextDrag, type SegmentEntry } from "./useTimelineDrag";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TARGET_VISIBLE_SECONDS = 30;
const MIN_PPS = 20;
const MAX_PPS = 80;
const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 24;
const TIMELINE_PAD = 40;
const EDGE_HANDLE_WIDTH = 6;

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
  audioDuration?: number;
  playbackProgress?: number | null;
  onPlayheadSeek?: (fraction: number) => void;
  actualSegments?: SegmentTiming[];
  actualTotalDuration?: number;
  onUpdateScene?: (sceneId: string, updates: Partial<Scene>) => void;
  onUpdateTransition?: (fromSceneId: number, toSceneId: number, updates: Partial<Transition>) => void;
  colorGradeEnabled?: boolean;
  textItems?: TextItem[];
  selectedTextId?: string | null;
  onSelectText?: (id: string) => void;
  onUpdateTextItem?: (id: string, updates: Partial<TextItem>) => void;
  onReorderScenes?: (sceneIds: number[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EditorTimeline({
  scenes, transitions, selectedSceneId, selectedTransition,
  onSelectScene, onSelectTransition,
  audioMode, audioFilename, audioDuration: audioDurationProp,
  playbackProgress, onPlayheadSeek,
  actualSegments, actualTotalDuration,
  onUpdateScene, onUpdateTransition,
  colorGradeEnabled, textItems, selectedTextId, onSelectText, onUpdateTextItem,
  onReorderScenes,
}: EditorTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [playheadPos, setPlayheadPos] = useState(0);
  const playheadPosRef = useRef(0);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);

  // Measure container width
  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Layout computations ---

  const totalDuration = useMemo(() => {
    if (actualTotalDuration != null && actualTotalDuration > 0) {
      return Math.max(actualTotalDuration, audioDurationProp ?? 0);
    }
    const sceneDur = scenes.reduce((sum, s) => sum + effectiveDuration(s), 0);
    const transDur = transitions.reduce((sum, t) => sum + effectiveDuration(t), 0);
    return Math.max(sceneDur + transDur, audioDurationProp ?? 0);
  }, [scenes, transitions, audioDurationProp, actualTotalDuration]);

  const pixelsPerSecond = useMemo(() => {
    const available = containerWidth - TIMELINE_PAD * 2;
    return Math.max(MIN_PPS, Math.min(MAX_PPS, available / TARGET_VISIBLE_SECONDS));
  }, [containerWidth]);

  const segmentLayout = useMemo(() => {
    let offset = 0;
    const segments: SegmentEntry[] = [];
    let actualIdx = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      let sceneDur = effectiveDuration(scene);
      if (actualSegments && actualIdx < actualSegments.length) {
        const as = actualSegments[actualIdx];
        if (as.type === "scene" && as.sceneIdx === i) { sceneDur = as.wallEnd - as.wallStart; actualIdx++; }
      }
      const sceneWidth = sceneDur * pixelsPerSecond;
      segments.push({ type: "scene", scene, idx: i, offset, width: sceneWidth });
      offset += sceneWidth;

      if (i < scenes.length - 1) {
        const sceneNum = scene.scene_id ?? i + 1;
        const trans = transitions.find((t) => t.from_scene_id === sceneNum);
        if (trans && trans.duration > 0) {
          let transDur = effectiveDuration(trans);
          if (actualSegments && actualIdx < actualSegments.length) {
            const as = actualSegments[actualIdx];
            if (as.type === "transition") { transDur = as.wallEnd - as.wallStart; actualIdx++; }
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

  const snapPoints = useMemo(() => {
    const points: number[] = [];
    if (audioDurationProp && audioDurationProp > 0) points.push(audioDurationProp * pixelsPerSecond);
    for (const seg of segmentLayout) { points.push(seg.offset); points.push(seg.offset + seg.width); }
    return [...new Set(points)];
  }, [audioDurationProp, pixelsPerSecond, segmentLayout]);

  const sceneLayout = useMemo(
    () => segmentLayout.filter((s): s is Extract<SegmentEntry, { type: "scene" }> => s.type === "scene"),
    [segmentLayout]
  );

  // --- Drag hooks ---

  const edge = useEdgeDrag(segmentLayout, snapPoints, pixelsPerSecond, onUpdateScene, onUpdateTransition);
  const reorder = useReorderDrag(segmentLayout, onReorderScenes);
  const text = useTextDrag(pixelsPerSecond, snapPoints, textItems, onUpdateTextItem);

  // --- Playhead ---

  useEffect(() => {
    if (playbackProgress != null && !isDraggingPlayhead) {
      setPlayheadPos(Math.max(0, Math.min(playbackProgress * totalWidth, totalWidth)));
    }
  }, [playbackProgress, totalWidth, isDraggingPlayhead]);

  const ticks = useMemo(() => {
    const lastTick = Math.floor(totalDuration);
    const result: Array<{ time: number; x: number; major: boolean }> = [];
    for (let t = 0; t <= lastTick; t += 1) {
      result.push({ time: t, x: t * pixelsPerSecond, major: t % 5 === 0 || t === lastTick });
    }
    return result;
  }, [totalDuration, pixelsPerSecond]);

  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollRef.current.scrollLeft - TIMELINE_PAD;
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
      const pos = Math.max(0, Math.min(e.clientX - rect.left + scrollRef.current.scrollLeft - TIMELINE_PAD, totalWidth));
      playheadPosRef.current = pos;
      setPlayheadPos(pos);
    };
    const handleUp = () => {
      setIsDraggingPlayhead(false);
      if (totalWidth > 0) queueMicrotask(() => onPlayheadSeek?.(playheadPosRef.current / totalWidth));
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [isDraggingPlayhead, totalWidth]);

  // Scroll to selected scene
  useEffect(() => {
    if (!selectedSceneId || !scrollRef.current) return;
    const layout = sceneLayout.find((l) => l.scene.id === selectedSceneId);
    if (!layout) return;
    scrollRef.current.scrollTo({ left: layout.offset + layout.width / 2 - scrollRef.current.clientWidth / 2, behavior: "smooth" });
  }, [selectedSceneId, sceneLayout]);

  const displayPlayheadTime = totalWidth > 0 ? (playheadPos / totalWidth) * totalDuration : 0;

  // --- Render helpers ---

  function renderEdgeHandles(segIdx: number) {
    return (
      <>
        <div
          data-edge-handle
          className="absolute top-0 bottom-0 left-0 z-20 cursor-col-resize group/edge"
          style={{ width: EDGE_HANDLE_WIDTH }}
          onMouseDown={(e) => edge.handleEdgeMouseDown(e, segIdx, "left")}
        >
          <div className="absolute inset-y-1 left-0 w-[2px] bg-amber-500 opacity-0 group-hover/edge:opacity-100 transition-opacity rounded-full" />
        </div>
        <div
          data-edge-handle
          className="absolute top-0 bottom-0 right-0 z-20 cursor-col-resize group/edge"
          style={{ width: EDGE_HANDLE_WIDTH }}
          onMouseDown={(e) => edge.handleEdgeMouseDown(e, segIdx, "right")}
        >
          <div className="absolute inset-y-1 right-0 w-[2px] bg-amber-500 opacity-0 group-hover/edge:opacity-100 transition-opacity rounded-full" />
        </div>
      </>
    );
  }

  // Compute reorder offset for a given scene
  function getReorderOffset(scene: Scene): number {
    const drag = reorder.reorderDrag;
    if (!drag) return 0;

    const isBeingDragged = drag.sceneId === scene.scene_id;
    if (isBeingDragged) return drag.currentX - drag.startX;

    // Shift non-dragged clips to show insertion preview
    const targetIdx = reorder.reorderTargetIdx;
    if (targetIdx == null) return 0;

    const dragIdx = sceneLayout.findIndex((e) => e.scene.scene_id === drag.sceneId);
    const thisIdx = sceneLayout.findIndex((e) => e.scene.scene_id === scene.scene_id);
    if (dragIdx < 0 || thisIdx < 0) return 0;

    const dragWidth = sceneLayout[dragIdx]?.width ?? 0;
    if (targetIdx > dragIdx && thisIdx > dragIdx && thisIdx <= targetIdx) return -dragWidth;
    if (targetIdx < dragIdx && thisIdx >= targetIdx && thisIdx < dragIdx) return dragWidth;
    return 0;
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
      {/* Timecode bar */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-slate-800/50 flex-shrink-0">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Timeline</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-amber-400">{formatDuration(displayPlayheadTime)}</span>
          <span className="text-xs text-slate-600">/</span>
          <span className="text-xs font-mono text-slate-400">{formatDuration(totalDuration)}</span>
        </div>
      </div>

      {/* Scrollable tracks */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto max-h-[280px] relative" style={{ minHeight: 0 }}>
        <div className="relative" style={{ width: totalWidth + TIMELINE_PAD * 2, minWidth: "100%" }}>

          {/* Ruler */}
          <div
            className="sticky top-0 z-10 bg-slate-900 relative border-b border-slate-800/50 select-none cursor-crosshair"
            style={{ height: RULER_HEIGHT }}
            onMouseDown={handleRulerMouseDown}
          >
            {ticks.map((tick) => (
              <div key={tick.time} className="absolute top-0" style={{ left: tick.x + TIMELINE_PAD }}>
                <div className={cn("w-px", tick.major ? "h-3 bg-slate-500" : "h-2 bg-slate-700")} />
                {tick.major && (
                  <span className="absolute top-3 -translate-x-1/2 text-[9px] text-slate-500 font-mono">
                    {formatDuration(tick.time)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Video track */}
          <div className="relative flex items-center" style={{ height: TRACK_HEIGHT }}>
            {segmentLayout.map((entry, segIdx) => {
              if (entry.type === "scene") {
                const { scene, offset: baseOffset, width: baseWidth } = entry;
                const isSelected = scene.id === selectedSceneId;
                const isDragging = edge.edgeDrag?.segmentIndex === segIdx;
                const isReordering = reorder.reorderDrag?.sceneId === scene.scene_id;
                const { offset, width } = edge.getSegmentVisuals(segIdx, baseOffset, baseWidth);
                const displaySpeed = isDragging && edge.dragPreviewSpeed != null ? edge.dragPreviewSpeed : (scene.speed ?? 1.0);
                const reorderOffset = getReorderOffset(scene);

                return (
                  <div
                    key={`scene-${scene.id}`}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md overflow-hidden border group",
                      isReordering
                        ? "border-amber-400 ring-2 ring-amber-400/50 z-30 opacity-80 cursor-grabbing shadow-lg shadow-amber-500/20"
                        : isDragging
                        ? "border-amber-400 ring-1 ring-amber-400/40 z-20 cursor-pointer"
                        : isSelected
                        ? "border-amber-500 ring-1 ring-amber-500/30 z-10 cursor-grab"
                        : "border-slate-700 hover:border-slate-500 cursor-grab"
                    )}
                    style={{
                      left: offset + TIMELINE_PAD + reorderOffset,
                      width: Math.max(width - 2, 24),
                      transition: isReordering ? "none" : "left 150ms ease",
                    }}
                    onClick={() => {
                      if (edge.wasEdgeDragging.current || reorder.wasReorderDragging.current) return;
                      onSelectScene(scene.id);
                    }}
                    onMouseDown={(e) => reorder.handleReorderMouseDown(e, scene.scene_id, segIdx)}
                  >
                    {isSelected && <div className="absolute inset-0 bg-amber-500/20 z-[1]" />}

                    {/* Filmstrip / keyframe / beat color */}
                    {scene.clip_url ? (
                      <FilmstripThumbnail src={clipUrl(scene.clip_url)} clipWidth={Math.max(width - 2, 24)} clipHeight={TRACK_HEIGHT - 8} />
                    ) : (scene.keyframe_path || scene.keyframe_url) ? (
                      <div className="absolute inset-0 overflow-hidden opacity-50">
                        <img src={scene.keyframe_path ? clipUrl(`/files/${scene.keyframe_path}`) : scene.keyframe_url!} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={cn("absolute inset-0 opacity-30", BEAT_COLORS[scene.beat])} />
                    )}

                    {/* Duration */}
                    <div className="relative z-10 flex items-center px-2 h-full">
                      {width > 50 && <span className="text-[9px] text-white/40 font-mono ml-auto">{formatDuration(width / pixelsPerSecond)}</span>}
                    </div>

                    {/* Speed badge */}
                    {displaySpeed !== 1.0 && (
                      <div className={cn("absolute top-0.5 right-1 text-[8px] font-mono rounded px-0.5", isDragging ? "text-amber-300 bg-amber-500/30" : "text-cyan-400 bg-cyan-500/20")}>
                        {displaySpeed}x
                      </div>
                    )}

                    {/* Status dot */}
                    {scene.clip_url && <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {!scene.clip_url && (scene.keyframe_path || scene.keyframe_url) && <div className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}

                    {renderEdgeHandles(segIdx)}
                  </div>
                );
              } else {
                // Transition
                const { transition, offset: baseOffset, width: baseWidth } = entry;
                const transKey = `${transition.from_scene_id}_${transition.to_scene_id}`;
                const hasClip = !!transition.clip_path;
                const isTransSelected = selectedTransition?.fromSceneId === transition.from_scene_id && selectedTransition?.toSceneId === transition.to_scene_id;
                const isDragging = edge.edgeDrag?.segmentIndex === segIdx;
                const { offset, width } = edge.getSegmentVisuals(segIdx, baseOffset, baseWidth);
                const displaySpeed = isDragging && edge.dragPreviewSpeed != null ? edge.dragPreviewSpeed : transition.speed;

                return (
                  <div
                    key={`trans-${transKey}`}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md border-2 flex items-center justify-center overflow-hidden cursor-pointer",
                      isDragging ? "border-amber-400 bg-gradient-to-b from-amber-500/30 to-amber-600/20 ring-1 ring-amber-400/40 z-20"
                        : isTransSelected ? "border-amber-400 bg-gradient-to-b from-amber-500/30 to-amber-600/20 ring-1 ring-amber-500/30 z-20"
                        : hasClip ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/20 to-emerald-600/10 z-10 hover:border-emerald-400"
                        : "border-dashed border-slate-500 bg-slate-700/40 z-10 hover:border-slate-400 hover:bg-slate-600/40"
                    )}
                    style={{ left: offset + TIMELINE_PAD, width: Math.max(width - 2, 24) }}
                    onClick={(e) => { if (edge.wasEdgeDragging.current) return; e.stopPropagation(); onSelectTransition?.(transition.from_scene_id, transition.to_scene_id); }}
                  >
                    {hasClip ? (
                      <FilmstripThumbnail src={clipUrl(`/files/${transition.clip_path}`)} clipWidth={Math.max(width - 2, 24)} clipHeight={TRACK_HEIGHT - 8} />
                    ) : (
                      <Sparkles className="w-3 h-3 text-slate-500" />
                    )}
                    {width > 40 && <span className="absolute bottom-0.5 right-1 text-[8px] text-white/40 font-mono">{formatDuration(width / pixelsPerSecond)}</span>}
                    {displaySpeed !== 1.0 && (
                      <div className={cn("absolute top-0.5 right-1 text-[8px] font-mono rounded px-0.5", isDragging ? "text-amber-300 bg-amber-500/30" : "text-cyan-400 bg-cyan-500/20")}>
                        {displaySpeed}x
                      </div>
                    )}
                    {renderEdgeHandles(segIdx)}
                  </div>
                );
              }
            })}
          </div>

          {/* Color grade track */}
          {colorGradeEnabled && (
            <div className="relative border-t border-slate-800/50" style={{ height: 24 }}>
              <div className="absolute top-0.5 bottom-0.5 rounded bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-500/30 flex items-center px-2 gap-1.5" style={{ left: TIMELINE_PAD, width: totalWidth }}>
                <Palette className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="text-[9px] text-amber-300/80 font-medium">Color Grading</span>
              </div>
            </div>
          )}

          {/* Text tracks */}
          {textItems?.map((item) => {
            const isDragging = text.textDrag?.id === item.id && text.textDragFrame != null;
            const isResizing = text.textResize?.id === item.id && text.textResizePreview != null;
            const isItemSnapping = isDragging && text.textSnapping;
            const displayFrame = isDragging ? text.textDragFrame! : isResizing ? text.textResizePreview!.frame : item.from_frame;
            const displayDuration = isResizing ? text.textResizePreview!.duration : item.duration_frames;
            const left = (displayFrame / 30) * pixelsPerSecond;
            const width = Math.max((displayDuration / 30) * pixelsPerSecond, 20);
            const isSelected = selectedTextId === item.id;

            return (
              <div key={item.id} className="relative border-t border-slate-800/50" style={{ height: 28 }}>
                <div
                  className={cn(
                    "absolute top-0.5 bottom-0.5 rounded cursor-pointer flex items-center px-2 gap-1",
                    isItemSnapping ? "bg-amber-500/30 border-2 border-amber-400 ring-2 ring-amber-400/50"
                      : isSelected ? "bg-violet-500/30 border-2 border-amber-400"
                      : "bg-violet-500/20 border border-violet-500/30 hover:border-violet-400/50"
                  )}
                  style={{ left: left + TIMELINE_PAD, width, transition: isItemSnapping ? "none" : undefined }}
                  onClick={(e) => { e.stopPropagation(); onSelectText?.(item.id); }}
                  onMouseDown={(e) => text.handleTextDragStart(e, item)}
                >
                  <Type className="w-3 h-3 text-violet-400 flex-shrink-0" />
                  <span className="text-[9px] text-violet-300 truncate">{item.text || "Text"}</span>
                  <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-amber-400/30 rounded-r" onMouseDown={(e) => { e.stopPropagation(); text.handleTextResizeStart(e, item, "right"); }} />
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-amber-400/30 rounded-l" onMouseDown={(e) => { e.stopPropagation(); text.handleTextResizeStart(e, item, "left"); }} />
                </div>
              </div>
            );
          })}

          {/* Audio track */}
          <div className="relative border-t border-slate-800/50" style={{ height: 32 }}>
            {(audioMode === "uploaded" || audioMode === "upload") && audioFilename ? (
              <div className="absolute top-1 bottom-1 rounded bg-indigo-500/20 border border-indigo-500/30 flex items-center px-2 gap-1.5" style={{ left: TIMELINE_PAD, width: (audioDurationProp ?? totalDuration) * pixelsPerSecond }}>
                <Volume2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                <span className="text-[10px] text-indigo-300 truncate">{audioFilename}</span>
              </div>
            ) : audioMode === "narration" ? (
              sceneLayout.map(({ scene, offset, width }) => (
                <div key={`nar-${scene.id}`} className="absolute top-1 bottom-1 rounded bg-violet-500/15 border border-violet-500/20" style={{ left: offset + TIMELINE_PAD, width: Math.max(width - 2, 8) }}>
                  <span className="text-[9px] text-violet-400 px-1 truncate block leading-[24px]">Narration</span>
                </div>
              ))
            ) : audioMode === "auto" ? (
              <div className="absolute top-1 bottom-1 rounded bg-slate-800/50 border border-slate-700/30 flex items-center px-2" style={{ left: TIMELINE_PAD, width: totalWidth }}>
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

          {/* Snap guide */}
          <div
            ref={text.snapGuideRef}
            className="absolute top-0 bottom-0 pointer-events-none z-40"
            style={{
              display: (edge.snapGuidePos ?? text.resizeSnapGuidePos) != null ? "block" : "none",
              left: ((edge.snapGuidePos ?? text.resizeSnapGuidePos) ?? 0) + TIMELINE_PAD,
              width: 2,
              background: "rgb(245 158 11)",
              boxShadow: "0 0 8px 2px rgb(245 158 11 / 0.6), 0 0 2px 0 rgb(245 158 11)",
            }}
          />

          {/* Playhead */}
          <div className="absolute top-0 bottom-0 w-px bg-amber-500 pointer-events-none z-30" style={{ left: playheadPos + TIMELINE_PAD }}>
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2.5 h-3 bg-amber-500 rounded-b-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
