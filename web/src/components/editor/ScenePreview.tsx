"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Image as ImageIcon } from "lucide-react";
import type { Scene } from "@/lib/api";
import { clipUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type PreviewMode = "clip" | "keyframe";

interface ScenePreviewProps {
  scene: Scene | null;
  mode?: PreviewMode;
  onModeChange?: (mode: PreviewMode) => void;
  /** Mutable ref updated with current video time on timeupdate events */
  videoTimeRef?: React.MutableRefObject<number>;
}

export type { PreviewMode };

export function ScenePreview({
  scene,
  mode: controlledMode,
  onModeChange,
  videoTimeRef,
}: ScenePreviewProps) {
  const hasClip = !!scene?.clip_url;
  const hasKeyframe = !!(scene?.keyframe_path || scene?.keyframe_url);

  const videoRef = useRef<HTMLVideoElement>(null);

  const [internalMode, setInternalMode] = useState<PreviewMode>(hasClip ? "clip" : "keyframe");
  const mode = controlledMode ?? internalMode;
  const setMode = (m: PreviewMode) => {
    setInternalMode(m);
    onModeChange?.(m);
  };

  useEffect(() => {
    const newMode = hasClip ? "clip" : "keyframe";
    setInternalMode(newMode);
    onModeChange?.(newMode);
  }, [scene?.id, hasClip, hasKeyframe]);

  const showClip = mode === "clip" && hasClip;
  const showKeyframe = mode === "keyframe" && hasKeyframe;

  const emptyLabel =
    mode === "clip"
      ? "No clip generated"
      : "No keyframe generated";

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Preview area — 9:16 vertical */}
      <div className="relative bg-slate-950 mx-auto" style={{ aspectRatio: "9/16" }}>
        {showClip ? (
          <video
            ref={videoRef}
            key={`${scene!.clip_url}-${scene!.id}`}
            controls
            src={`${clipUrl(scene!.clip_url!)}?t=${Date.now()}`}
            className="w-full h-full object-cover"
            preload="metadata"
            aria-label={`Scene preview: ${scene!.beat}`}
            onLoadedMetadata={(e) => {
              const speed = scene?.speed ?? 1.0;
              if (speed !== 1.0) (e.target as HTMLVideoElement).playbackRate = speed;
            }}
            onTimeUpdate={(e) => {
              if (videoTimeRef) videoTimeRef.current = (e.target as HTMLVideoElement).currentTime;
            }}
          />
        ) : showKeyframe ? (
          <img
            key={`kf-${scene!.keyframe_path || scene!.keyframe_url}-${scene!.id}`}
            src={scene!.keyframe_path ? clipUrl(`/files/${scene!.keyframe_path}`) : scene!.keyframe_url!}
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
