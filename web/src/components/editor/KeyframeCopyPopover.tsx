"use client";

import React, { useState, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Scene } from "@/lib/api";
import { cn, BEAT_TEXT_COLORS } from "@/lib/utils";

interface KeyframeCopyPopoverProps {
  scenes: Scene[];
  currentSceneId: number;
  onCopy: (targetSceneIds: number[]) => Promise<void>;
  disabled?: boolean;
}

export function KeyframeCopyPopover({
  scenes,
  currentSceneId,
  onCopy,
  disabled,
}: KeyframeCopyPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copying, setCopying] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setDone(false);
    }
  }, [open]);

  const otherScenes = scenes.filter(
    (s) => (s.scene_id ?? Number(s.id)) !== currentSceneId
  );

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === otherScenes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(otherScenes.map((s) => s.scene_id ?? Number(s.id))));
    }
  };

  const handleApply = async () => {
    if (selected.size === 0) return;
    setCopying(true);
    try {
      await onCopy(Array.from(selected));
      setDone(true);
      setTimeout(() => setOpen(false), 800);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <Copy className="w-4 h-4" />
        Copy to...
      </Button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-72 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              Copy keyframe to scenes
            </span>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              {selected.size === otherScenes.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          {/* Scene list */}
          <div className="max-h-60 overflow-y-auto p-1">
            {otherScenes.map((scene) => {
              const sid = scene.scene_id ?? Number(scene.id);
              const isSelected = selected.has(sid);
              const hasKeyframe = !!scene.keyframe_url;
              const hasClip = !!scene.clip_url;

              return (
                <label
                  key={sid}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                    isSelected
                      ? "bg-amber-500/10"
                      : "hover:bg-slate-700/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(sid)}
                    className="rounded border-slate-600"
                  />
                  {/* Thumbnail */}
                  <div className="w-8 h-14 rounded overflow-hidden bg-slate-900 flex-shrink-0">
                    {scene.keyframe_url ? (
                      <img
                        src={scene.keyframe_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-[8px]">
                        —
                      </div>
                    )}
                  </div>
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-xs font-medium", BEAT_TEXT_COLORS[scene.beat])}>
                        {scene.beat}
                      </span>
                      <span className="text-[10px] text-slate-500">#{sid}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {scene.visual_description?.slice(0, 50)}
                    </p>
                    {/* Status indicators */}
                    <div className="flex gap-2 mt-0.5">
                      {hasKeyframe && (
                        <span className="text-[9px] text-emerald-500">keyframe</span>
                      )}
                      {hasClip && (
                        <span className="text-[9px] text-amber-500">clip</span>
                      )}
                      {hasKeyframe && (
                        <span className="text-[9px] text-yellow-600">will overwrite</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-slate-700">
            <Button
              size="sm"
              className="w-full gap-2"
              disabled={selected.size === 0 || copying}
              onClick={handleApply}
            >
              {done ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  {copying
                    ? "Copying..."
                    : `Copy to ${selected.size} scene${selected.size !== 1 ? "s" : ""}`}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
