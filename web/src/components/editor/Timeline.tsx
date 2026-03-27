"use client";

import React, { useMemo } from "react";
import type { Scene } from "@/lib/api";
import { cn, BEAT_COLORS, formatDuration } from "@/lib/utils";

interface TimelineProps {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
}

export function Timeline({
  scenes,
  selectedSceneId,
  onSelectScene,
}: TimelineProps) {
  const totalDuration = useMemo(
    () => scenes.reduce((sum, s) => sum + s.duration, 0),
    [scenes]
  );

  if (scenes.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-lg p-3 text-center text-sm text-slate-500">
        No scenes yet
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="flex items-center gap-1 h-10">
        {scenes.map((scene) => {
          const widthPercent = (scene.duration / totalDuration) * 100;
          const isSelected = scene.id === selectedSceneId;

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelectScene(scene.id)}
              className={cn(
                "relative h-full rounded transition-all duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                BEAT_COLORS[scene.beat],
                isSelected
                  ? "ring-2 ring-amber-500 brightness-110"
                  : "hover:brightness-125 opacity-80 hover:opacity-100"
              )}
              style={{
                width: `${widthPercent}%`,
                minWidth: "2rem",
              }}
              aria-label={`${scene.beat} - ${formatDuration(scene.duration)}`}
              aria-pressed={isSelected}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                <span className="font-medium text-white">{scene.beat}</span>
                <span className="text-slate-400 ml-1.5">
                  {formatDuration(scene.duration)}
                </span>
              </div>

              {/* Segment label (visible when wide enough) */}
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 truncate px-1">
                {scene.beat}
              </span>
            </button>
          );
        })}
      </div>

      {/* Total duration */}
      <div className="flex justify-end mt-2">
        <span className="text-xs text-slate-500 font-mono">
          Total: {formatDuration(totalDuration)}
        </span>
      </div>
    </div>
  );
}
