"use client";

import React, { useState, useEffect } from "react";
import { Film, Play, Image as ImageIcon } from "lucide-react";
import type { Scene } from "@/lib/api";
import { clipUrl } from "@/lib/api";
import { cn, BEAT_TEXT_COLORS, formatDuration } from "@/lib/utils";

type PreviewMode = "clip" | "keyframe";

interface ScenePreviewProps {
  scene: Scene | null;
}

export function ScenePreview({ scene }: ScenePreviewProps) {
  const hasClip = !!scene?.clip_url;
  const hasKeyframe = !!scene?.keyframe_url;

  const [mode, setMode] = useState<PreviewMode>(hasClip ? "clip" : "keyframe");

  useEffect(() => {
    if (hasClip) setMode("clip");
    else setMode("keyframe");
  }, [scene?.id, hasClip, hasKeyframe]);

  const showClip = mode === "clip" && hasClip;
  const showKeyframe = mode === "keyframe" && hasKeyframe;

  const emptyLabel =
    mode === "clip"
      ? "No clip generated"
      : "No keyframe generated";

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Toggle tabs — always visible when a scene is selected */}
      {scene && (
        <div className="flex border-b border-slate-800">
          <button
            type="button"
            onClick={() => setMode("clip")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
              mode === "clip"
                ? "text-amber-400 bg-amber-500/10 border-b-2 border-amber-500"
                : "text-slate-400 hover:text-slate-300"
            )}
          >
            <Play className="w-3.5 h-3.5" />
            Video Clip
            {hasClip && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>
          <button
            type="button"
            onClick={() => setMode("keyframe")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
              mode === "keyframe"
                ? "text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-500"
                : "text-slate-400 hover:text-slate-300"
            )}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Keyframe
            {hasKeyframe && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>
        </div>
      )}

      {/* Preview area — 9:16 vertical */}
      <div className="relative bg-slate-950 mx-auto" style={{ aspectRatio: "9/16", maxHeight: "55vh" }}>
        {showClip ? (
          <video
            key={`${scene!.clip_url}-${scene!.id}`}
            controls
            src={`${clipUrl(scene!.clip_url!)}?t=${Date.now()}`}
            className="w-full h-full object-cover"
            preload="metadata"
            aria-label={`Scene preview: ${scene!.beat}`}
          />
        ) : showKeyframe ? (
          <img
            key={`kf-${scene!.keyframe_url}-${scene!.id}`}
            src={scene!.keyframe_url!}
            alt={`Keyframe — ${scene!.beat}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800">
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center">
              {mode === "clip" ? (
                <Play className="w-7 h-7 text-slate-500 ml-0.5" />
              ) : (
                <ImageIcon className="w-7 h-7 text-slate-500" />
              )}
            </div>
            <span className="text-sm text-slate-500">
              {scene ? emptyLabel : "Select a scene to preview"}
            </span>
          </div>
        )}
      </div>


    </div>
  );
}
