"use client";

import React from "react";
import { Film, Play } from "lucide-react";
import type { Scene } from "@/lib/api";
import { clipUrl } from "@/lib/api";
import { cn, BEAT_TEXT_COLORS, formatDuration } from "@/lib/utils";

interface ScenePreviewProps {
  scene: Scene | null;
}

export function ScenePreview({ scene }: ScenePreviewProps) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Video area — 9:16 vertical */}
      <div className="relative bg-slate-950 mx-auto" style={{ aspectRatio: "9/16", maxHeight: "55vh" }}>
        {scene?.clip_url ? (
          <video
            key={`${scene.clip_url}-${Date.now()}`}
            controls
            src={`${clipUrl(scene.clip_url)}?t=${Date.now()}`}
            className="w-full h-full object-cover"
            preload="metadata"
            aria-label={`Scene preview: ${scene.beat}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800">
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center">
              {scene ? (
                <Play className="w-7 h-7 text-slate-500 ml-0.5" />
              ) : (
                <Film className="w-7 h-7 text-slate-500" />
              )}
            </div>
            <span className="text-sm text-slate-500">
              {scene ? "No clip generated" : "Select a scene to preview"}
            </span>
          </div>
        )}
      </div>

      {/* Info bar */}
      {scene && (
        <div className="px-4 py-2.5 flex items-center justify-between border-t border-slate-800">
          <span
            className={cn(
              "text-sm font-medium",
              BEAT_TEXT_COLORS[scene.beat]
            )}
          >
            {scene.beat}
          </span>
          <span className="text-sm text-slate-400 font-mono">
            {formatDuration(scene.duration)}
          </span>
        </div>
      )}
    </div>
  );
}
