"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/lib/api";
import { clipUrl, updateProject } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";

// Curated list of ~20 useful transitions (flat, alphabetical)
const TRANSITION_PILLS: Array<{ key: string; label: string }> = [
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

interface TransitionTimelineProps {
  scenes: Scene[];
  projectId: string;
  initialTransitions?: Array<{ scene_id: number; transition: string }>;
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
}

export function TransitionTimeline({
  scenes,
  projectId,
  initialTransitions,
  selectedSceneId,
  onSelectScene,
}: TransitionTimelineProps) {
  const [transitions, setTransitions] = useState<Record<number, string>>({});
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize transitions from props
  useEffect(() => {
    const map: Record<number, string> = {};
    if (initialTransitions) {
      for (const t of initialTransitions) {
        map[t.scene_id] = t.transition;
      }
    }
    setTransitions(map);
    setDirty(false);
  }, [initialTransitions]);

  // Close picker on outside click
  useEffect(() => {
    if (openPicker === null) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenPicker(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openPicker]);

  // Get label for a transition key
  const getTransitionLabel = useCallback(
    (sceneId: number): string => {
      const key = transitions[sceneId] || "fade";
      return PILL_LABEL_MAP[key] || key;
    },
    [transitions]
  );

  // Save transitions to backend
  const saveTransitions = useCallback(
    async (transMap: Record<number, string>) => {
      setSaving(true);
      try {
        const data = Object.entries(transMap).map(([sid, t]) => ({
          scene_id: Number(sid),
          transition: t,
        }));
        await updateProject(projectId, {
          transitions_json: JSON.stringify(data),
        } as never);
        setDirty(false);
      } catch (err) {
        console.error("Failed to save transitions:", err);
      } finally {
        setSaving(false);
      }
    },
    [projectId]
  );

  // Debounced auto-save
  const handleTransitionChange = useCallback(
    (sceneId: number, transitionKey: string) => {
      setTransitions((prev) => {
        const next = { ...prev, [sceneId]: transitionKey };
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => saveTransitions(next), 1500);
        return next;
      });
      setDirty(true);
      setOpenPicker(null);
    },
    [saveTransitions]
  );

  if (scenes.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Timeline
        </h3>
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-amber-400 hover:text-amber-300"
            onClick={() => saveTransitions(transitions)}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-2 scrollbar-thin">
        {scenes.map((scene, idx) => {
          const sceneNum = scene.scene_id ?? idx + 1;
          const isSelected = scene.id === selectedSceneId;
          const isLastScene = idx === scenes.length - 1;
          const currentTransition = transitions[sceneNum] || "fade";

          return (
            <React.Fragment key={scene.id}>
              {/* Scene card */}
              <button
                type="button"
                onClick={() => onSelectScene(scene.id)}
                className={cn(
                  "flex-shrink-0 w-[140px] rounded-lg border px-2.5 py-2 text-left transition-all",
                  isSelected
                    ? "border-amber-500/60 bg-amber-500/10"
                    : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600"
                )}
              >
                {/* Thumbnail — show clip video, keyframe image, or placeholder */}
                {scene.clip_url ? (
                  <div className="w-full h-16 rounded overflow-hidden mb-1.5">
                    <video
                      src={clipUrl(scene.clip_url)}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  </div>
                ) : scene.keyframe_url ? (
                  <div className="w-full h-16 rounded overflow-hidden mb-1.5">
                    <img
                      src={scene.keyframe_url}
                      alt={`Scene ${sceneNum}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-16 rounded bg-slate-700/50 mb-1.5 flex items-center justify-center">
                    <span className="text-slate-500 text-[10px]">No preview</span>
                  </div>
                )}
                <div className="text-[11px] font-medium text-slate-300 truncate">
                  Scene {sceneNum}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {formatDuration(scene.duration)}
                </div>
              </button>

              {/* Transition chip between scenes */}
              {!isLastScene && (
                <div className="flex-shrink-0 flex items-center justify-center px-1 relative">
                  <button
                    type="button"
                    ref={(el) => { chipRefs.current[sceneNum] = el; }}
                    onClick={() =>
                      setOpenPicker(openPicker === sceneNum ? null : sceneNum)
                    }
                    className={cn(
                      "flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all border whitespace-nowrap",
                      openPicker === sceneNum
                        ? "border-amber-500 bg-amber-500/20 text-amber-300"
                        : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                    )}
                  >
                    <span className="max-w-[70px] truncate">
                      {getTransitionLabel(sceneNum)}
                    </span>
                  </button>

                  {/* Visual grid popover — fixed position to escape overflow clip */}
                  {openPicker === sceneNum && (() => {
                    const rect = chipRefs.current[sceneNum]?.getBoundingClientRect();
                    const style = rect ? {
                      position: "fixed" as const,
                      left: Math.max(8, rect.left - 100),
                      bottom: window.innerHeight - rect.top + 8,
                      zIndex: 9999,
                    } : {};
                    return (
                    <div
                      ref={pickerRef}
                      className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 w-[280px]"
                      style={style}
                    >
                      <div className="flex flex-wrap gap-1">
                        {TRANSITION_PILLS.map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              handleTransitionChange(sceneNum, key)
                            }
                            className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-medium border transition-colors",
                              currentTransition === key
                                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                                : "border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700"
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
    </div>
  );
}
