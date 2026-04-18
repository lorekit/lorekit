"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { Scene, Transition, TextItem } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Shared constants                                                    */
/* ------------------------------------------------------------------ */

const MIN_SPEED = 0.25;
const MAX_SPEED = 4.0;
const SNAP_THRESHOLD = 8;
const TEXT_SNAP_THRESHOLD = 12;

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type SegmentEntry =
  | { type: "scene"; scene: Scene; idx: number; offset: number; width: number }
  | { type: "transition"; transition: Transition; offset: number; width: number };

interface EdgeDragState {
  segmentIndex: number;
  edge: "left" | "right";
  startX: number;
  originalWidth: number;
  clipDuration: number;
  segmentOffset: number;
}

/* ------------------------------------------------------------------ */
/*  useEdgeDrag — resize clips to adjust speed                         */
/* ------------------------------------------------------------------ */

export function useEdgeDrag(
  segmentLayout: SegmentEntry[],
  snapPoints: number[],
  pixelsPerSecond: number,
  onUpdateScene?: (id: string, updates: Partial<Scene>) => void,
  onUpdateTransition?: (from: number, to: number, updates: Partial<Transition>) => void,
) {
  const [edgeDrag, setEdgeDrag] = useState<EdgeDragState | null>(null);
  const [edgeDragDelta, setEdgeDragDelta] = useState(0);
  const edgeDragRef = useRef<EdgeDragState | null>(null);
  const edgeDragDeltaRef = useRef(0);
  const wasEdgeDragging = useRef(false);
  const [snapGuidePos, setSnapGuidePos] = useState<number | null>(null);

  const handleEdgeMouseDown = useCallback(
    (e: React.MouseEvent, segmentIndex: number, edge: "left" | "right") => {
      e.preventDefault();
      e.stopPropagation();
      const entry = segmentLayout[segmentIndex];
      if (!entry) return;
      const clipDuration = entry.type === "scene" ? entry.scene.duration : entry.transition.duration;
      const state: EdgeDragState = {
        segmentIndex, edge, startX: e.clientX,
        originalWidth: entry.width, clipDuration, segmentOffset: entry.offset,
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
      if (drag.edge === "left") delta = -delta;

      const minWidth = (drag.clipDuration / MAX_SPEED) * pixelsPerSecond;
      const maxWidth = (drag.clipDuration / MIN_SPEED) * pixelsPerSecond;
      let newWidth = Math.max(minWidth, Math.min(maxWidth, drag.originalWidth + delta));

      const draggedEdgePos = drag.edge === "right"
        ? drag.segmentOffset + newWidth
        : drag.segmentOffset + drag.originalWidth - newWidth;

      const ownLeft = drag.segmentOffset;
      const ownRight = drag.segmentOffset + drag.originalWidth;
      let snapped: number | null = null;
      let bestDist = SNAP_THRESHOLD;
      for (const sp of snapPoints) {
        if (Math.abs(sp - ownLeft) < 1 || Math.abs(sp - ownRight) < 1) continue;
        const dist = Math.abs(draggedEdgePos - sp);
        if (dist < bestDist) { bestDist = dist; snapped = sp; }
      }

      if (snapped != null) {
        newWidth = drag.edge === "right"
          ? snapped - drag.segmentOffset
          : (drag.segmentOffset + drag.originalWidth) - snapped;
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
  }, [edgeDrag, pixelsPerSecond, segmentLayout, snapPoints, onUpdateScene, onUpdateTransition]);

  const dragPreviewSpeed = useMemo(() => {
    if (!edgeDrag || Math.abs(edgeDragDelta) < 1) return null;
    const newWidth = edgeDrag.originalWidth + edgeDragDelta;
    const newEffectiveDur = newWidth / pixelsPerSecond;
    const speed = edgeDrag.clipDuration / newEffectiveDur;
    return Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(speed * 100) / 100));
  }, [edgeDrag, edgeDragDelta, pixelsPerSecond]);

  const getSegmentVisuals = useCallback(
    (segIdx: number, baseOffset: number, baseWidth: number) => {
      if (!edgeDrag || edgeDrag.segmentIndex !== segIdx) {
        return { offset: baseOffset, width: baseWidth };
      }
      const newWidth = baseWidth + edgeDragDelta;
      if (edgeDrag.edge === "left") {
        return { offset: baseOffset - edgeDragDelta, width: newWidth };
      }
      return { offset: baseOffset, width: newWidth };
    },
    [edgeDrag, edgeDragDelta]
  );

  return { edgeDrag, handleEdgeMouseDown, wasEdgeDragging, snapGuidePos, dragPreviewSpeed, getSegmentVisuals };
}

/* ------------------------------------------------------------------ */
/*  useReorderDrag — drag clips to reorder                             */
/* ------------------------------------------------------------------ */

export function useReorderDrag(
  segmentLayout: SegmentEntry[],
  onReorderScenes?: (sceneIds: number[]) => void,
) {
  const [reorderDrag, setReorderDrag] = useState<{
    sceneId: number; startX: number; currentX: number; originalIndex: number;
  } | null>(null);
  const reorderDragRef = useRef<typeof reorderDrag>(null);
  const wasReorderDragging = useRef(false);

  const handleReorderMouseDown = useCallback(
    (e: React.MouseEvent, sceneId: number, segIdx: number) => {
      if ((e.target as HTMLElement).closest("[data-edge-handle]")) return;
      const state = { sceneId, startX: e.clientX, currentX: e.clientX, originalIndex: segIdx };
      setReorderDrag(state);
      reorderDragRef.current = state;
      wasReorderDragging.current = false;
    },
    []
  );

  // Compute target index during drag (for visual feedback)
  const reorderTargetIdx = useMemo(() => {
    if (!reorderDrag || !wasReorderDragging.current) return null;
    const sceneEntries = segmentLayout.filter(
      (e): e is Extract<SegmentEntry, { type: "scene" }> => e.type === "scene"
    );
    const currentIdx = sceneEntries.findIndex((e) => e.scene.scene_id === reorderDrag.sceneId);
    if (currentIdx < 0) return null;
    const deltaX = reorderDrag.currentX - reorderDrag.startX;
    const segWidth = sceneEntries[currentIdx]?.width ?? 100;
    const slotsToMove = Math.round(deltaX / segWidth);
    return Math.max(0, Math.min(sceneEntries.length - 1, currentIdx + slotsToMove));
  }, [reorderDrag, segmentLayout]);

  useEffect(() => {
    if (!reorderDrag) return;

    const handleMove = (e: MouseEvent) => {
      const delta = Math.abs(e.clientX - reorderDragRef.current!.startX);
      if (delta > 8) {
        wasReorderDragging.current = true;
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }
      if (wasReorderDragging.current) {
        const updated = { ...reorderDragRef.current!, currentX: e.clientX };
        reorderDragRef.current = updated;
        setReorderDrag(updated);
      }
    };

    const handleUp = () => {
      if (wasReorderDragging.current && reorderDragRef.current) {
        const drag = reorderDragRef.current;
        const deltaX = drag.currentX - drag.startX;
        const sceneEntries = segmentLayout.filter(
          (e): e is Extract<SegmentEntry, { type: "scene" }> => e.type === "scene"
        );
        const currentIdx = sceneEntries.findIndex((e) => e.scene.scene_id === drag.sceneId);
        if (currentIdx >= 0) {
          const segWidth = sceneEntries[currentIdx]?.width ?? 100;
          const slotsToMove = Math.round(deltaX / segWidth);
          if (slotsToMove !== 0) {
            const newIdx = Math.max(0, Math.min(sceneEntries.length - 1, currentIdx + slotsToMove));
            if (newIdx !== currentIdx) {
              const newOrder = sceneEntries.map((e) => e.scene.scene_id);
              const [moved] = newOrder.splice(currentIdx, 1);
              newOrder.splice(newIdx, 0, moved);
              onReorderScenes?.(newOrder);
            }
          }
        }
      }

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setReorderDrag(null);
      reorderDragRef.current = null;
      setTimeout(() => { wasReorderDragging.current = false; }, 100);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [reorderDrag, segmentLayout, onReorderScenes]);

  return { reorderDrag, reorderTargetIdx, handleReorderMouseDown, wasReorderDragging };
}

/* ------------------------------------------------------------------ */
/*  useTextDrag — move + resize text overlays                          */
/* ------------------------------------------------------------------ */

export function useTextDrag(
  pixelsPerSecond: number,
  baseSnapPoints: number[],
  textItems: TextItem[] | undefined,
  onUpdateTextItem?: (id: string, updates: Partial<TextItem>) => void,
) {
  // --- Move ---
  const [textDrag, setTextDrag] = useState<{ id: string; startX: number; startFrame: number; durationFrames: number } | null>(null);
  const textDragRef = useRef<typeof textDrag>(null);
  const [textDragFrame, setTextDragFrame] = useState<number | null>(null);
  const textDragFrameRef = useRef<number | null>(null);
  const [textSnapping, setTextSnapping] = useState(false);
  const snapGuideRef = useRef<HTMLDivElement>(null);

  // --- Resize ---
  const [textResize, setTextResize] = useState<{
    id: string; edge: "left" | "right"; startX: number; startFrame: number; startDuration: number;
  } | null>(null);
  const textResizeRef = useRef<typeof textResize>(null);
  const [textResizePreview, setTextResizePreview] = useState<{ frame: number; duration: number } | null>(null);
  const textResizePreviewRef = useRef<typeof textResizePreview>(null);
  const [resizeSnapGuidePos, setResizeSnapGuidePos] = useState<number | null>(null);

  const allSnapPoints = useMemo(() => {
    const points = [...baseSnapPoints];
    if (textItems) {
      for (const t of textItems) {
        points.push((t.from_frame / 30) * pixelsPerSecond);
        points.push(((t.from_frame + t.duration_frames) / 30) * pixelsPerSecond);
      }
    }
    return [...new Set(points)];
  }, [baseSnapPoints, textItems, pixelsPerSecond]);

  const handleTextDragStart = useCallback((e: React.MouseEvent, item: TextItem) => {
    if ((e.target as HTMLElement).classList.contains("cursor-ew-resize")) return;
    e.preventDefault();
    e.stopPropagation();
    const state = { id: item.id, startX: e.clientX, startFrame: item.from_frame, durationFrames: item.duration_frames };
    textDragRef.current = state;
    setTextDrag(state);
    setTextDragFrame(item.from_frame);
    textDragFrameRef.current = item.from_frame;
  }, []);

  useEffect(() => {
    if (!textDrag) return;

    const handleMove = (e: MouseEvent) => {
      const drag = textDragRef.current;
      if (!drag) return;
      const deltaPx = e.clientX - drag.startX;
      const deltaFrames = Math.round((deltaPx / pixelsPerSecond) * 30);
      let newFrame = Math.max(0, drag.startFrame + deltaFrames);

      const leftPx = (newFrame / 30) * pixelsPerSecond;
      const rightPx = ((newFrame + drag.durationFrames) / 30) * pixelsPerSecond;

      // Filter out self edges for snapping
      const snapTargets = allSnapPoints.filter((sp) => {
        const selfLeft = (drag.startFrame / 30) * pixelsPerSecond;
        const selfRight = ((drag.startFrame + drag.durationFrames) / 30) * pixelsPerSecond;
        return Math.abs(sp - selfLeft) > 1 && Math.abs(sp - selfRight) > 1;
      });

      let snapped: number | null = null;
      let bestDist = TEXT_SNAP_THRESHOLD;
      for (const sp of snapTargets) {
        const distL = Math.abs(leftPx - sp);
        if (distL < bestDist) {
          bestDist = distL; snapped = sp;
          newFrame = Math.max(0, Math.round((sp / pixelsPerSecond) * 30));
        }
        const distR = Math.abs(rightPx - sp);
        if (distR < bestDist) {
          bestDist = distR; snapped = sp;
          newFrame = Math.max(0, Math.round(((sp / pixelsPerSecond) - (drag.durationFrames / 30)) * 30));
        }
      }

      const guideEl = snapGuideRef.current;
      if (guideEl) {
        if (snapped != null) { guideEl.style.display = "block"; guideEl.style.left = `${snapped + 40}px`; }
        else { guideEl.style.display = "none"; }
      }

      setTextSnapping(snapped != null);
      textDragFrameRef.current = newFrame;
      setTextDragFrame(newFrame);
    };

    const handleUp = () => {
      const newFrame = textDragFrameRef.current;
      const drag = textDragRef.current;
      if (drag && newFrame != null && newFrame !== drag.startFrame) {
        onUpdateTextItem?.(drag.id, { from_frame: newFrame });
      }
      textDragRef.current = null;
      textDragFrameRef.current = null;
      setTextDrag(null);
      setTextDragFrame(null);
      setTextSnapping(false);
      const guideEl = snapGuideRef.current;
      if (guideEl) guideEl.style.display = "none";
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [textDrag, pixelsPerSecond, onUpdateTextItem, allSnapPoints]);

  const handleTextResizeStart = useCallback((e: React.MouseEvent, item: TextItem, edge: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    const state = { id: item.id, edge, startX: e.clientX, startFrame: item.from_frame, startDuration: item.duration_frames };
    textResizeRef.current = state;
    setTextResize(state);
    setTextResizePreview({ frame: item.from_frame, duration: item.duration_frames });
    textResizePreviewRef.current = { frame: item.from_frame, duration: item.duration_frames };
  }, []);

  useEffect(() => {
    if (!textResize) return;

    const handleMove = (e: MouseEvent) => {
      const drag = textResizeRef.current;
      if (!drag) return;
      const deltaPx = e.clientX - drag.startX;
      const deltaFrames = Math.round((deltaPx / pixelsPerSecond) * 30);

      let newFrame: number;
      let newDuration: number;
      if (drag.edge === "right") {
        newFrame = drag.startFrame;
        newDuration = Math.max(15, drag.startDuration + deltaFrames);
      } else {
        newFrame = Math.max(0, drag.startFrame + deltaFrames);
        newDuration = Math.max(15, drag.startDuration - (newFrame - drag.startFrame));
      }

      const edgePx = drag.edge === "right"
        ? ((newFrame + newDuration) / 30) * pixelsPerSecond
        : (newFrame / 30) * pixelsPerSecond;

      let snapped: number | null = null;
      let bestDist = TEXT_SNAP_THRESHOLD;
      for (const sp of allSnapPoints) {
        const dist = Math.abs(edgePx - sp);
        if (dist < bestDist) { bestDist = dist; snapped = sp; }
      }

      if (snapped != null) {
        const snappedFrame = Math.round((snapped / pixelsPerSecond) * 30);
        if (drag.edge === "right") {
          newDuration = Math.max(15, snappedFrame - newFrame);
        } else {
          newFrame = Math.max(0, snappedFrame);
          newDuration = Math.max(15, drag.startDuration - (newFrame - drag.startFrame));
        }
        setResizeSnapGuidePos(snapped);
      } else {
        setResizeSnapGuidePos(null);
      }

      const preview = { frame: newFrame, duration: newDuration };
      textResizePreviewRef.current = preview;
      setTextResizePreview(preview);
    };

    const handleUp = () => {
      const drag = textResizeRef.current;
      const preview = textResizePreviewRef.current;
      if (drag && preview && (preview.frame !== drag.startFrame || preview.duration !== drag.startDuration)) {
        onUpdateTextItem?.(drag.id, { from_frame: preview.frame, duration_frames: preview.duration });
      }
      textResizeRef.current = null;
      textResizePreviewRef.current = null;
      setTextResize(null);
      setTextResizePreview(null);
      setResizeSnapGuidePos(null);
    };

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [textResize, pixelsPerSecond, onUpdateTextItem, allSnapPoints]);

  return {
    textDrag, textDragFrame, textSnapping, snapGuideRef,
    handleTextDragStart,
    textResize, textResizePreview, resizeSnapGuidePos,
    handleTextResizeStart,
  };
}
