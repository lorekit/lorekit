"use client";

import React from "react";
import { Film } from "lucide-react";
import type { Scene } from "@/lib/api";
import { cn, BEAT_COLORS, BEAT_TEXT_COLORS, formatDuration } from "@/lib/utils";

interface SceneStripProps {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
}

export function SceneStrip({
  scenes,
  selectedSceneId,
  onSelectScene,
}: SceneStripProps) {
  return (
    <div className="bg-slate-900 border-t border-slate-800 p-3">
      <div className="scene-strip-scroll flex gap-2 overflow-x-auto pb-1">
        {scenes.map((scene) => {
          const isSelected = scene.id === selectedSceneId;

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelectScene(scene.id)}
              className={cn(
                "w-32 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                isSelected
                  ? "border-amber-500"
                  : "border-transparent hover:border-slate-600"
              )}
              aria-label={`Scene: ${scene.beat} - ${formatDuration(scene.duration)}`}
              aria-pressed={isSelected}
            >
              {/* Beat color bar */}
              <div className={cn("w-full h-1.5", BEAT_COLORS[scene.beat])} />

              {/* Thumbnail area - 16:9 */}
              <div className="relative w-full aspect-video bg-slate-800 flex items-center justify-center">
                {scene.clip_url ? (
                  <video
                    src={`http://localhost:8000${scene.clip_url}`}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                    aria-hidden="true"
                  />
                ) : (
                  <Film
                    className="w-6 h-6 text-slate-600"
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Info bar */}
              <div className="bg-slate-950 px-2 py-1.5 flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "text-xs font-medium truncate",
                    BEAT_TEXT_COLORS[scene.beat]
                  )}
                >
                  {scene.beat}
                </span>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {formatDuration(scene.duration)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
