"use client";

import React from "react";
import { RotateCcw, Quote, Loader2 } from "lucide-react";
import type { Scene } from "@/lib/api";
import { effectiveDuration } from "@/lib/api";
import { cn, BEAT_COLORS, BEAT_TEXT_COLORS, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface CharacterInfo {
  name: string;
  imageUrl: string | null;
}

interface SceneDetailProps {
  scene: Scene | null;
  characters?: CharacterInfo[];
  onUpdate: (sceneId: string, updates: Partial<Scene>) => void;
  onRegenerate: (sceneId: string) => void;
  isGenerating: boolean;
}

const BEAT_BADGE_COLORS: Record<string, string> = {
  HOOK: "bg-red-500/20 text-red-400 border-red-500/30",
  WORLD: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CONFLICT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  STILLNESS: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  TRUTH: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  LOOP: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function SceneDetail({
  scene,
  characters,
  onUpdate,
  onRegenerate,
  isGenerating,
}: SceneDetailProps) {
  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Select a scene to edit
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Clip Length */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="duration" className="text-slate-300">
            Clip Length
          </Label>
          <span className="text-sm font-mono text-amber-400">
            {formatDuration(scene.duration)}
          </span>
        </div>
        <Slider
          id="duration"
          min={3}
          max={15}
          step={0.5}
          value={scene.duration}
          onChange={(value) => onUpdate(scene.id, { duration: value })}
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>3s</span>
          <span>15s</span>
        </div>
      </div>

      {/* Speed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="speed" className="text-slate-300">
            Speed
          </Label>
          <span className="text-sm font-mono text-cyan-400">
            {(scene.speed ?? 1.0).toFixed(2)}x
          </span>
        </div>
        <Slider
          id="speed"
          min={0.25}
          max={4}
          step={0.25}
          value={scene.speed ?? 1.0}
          onChange={(value) => onUpdate(scene.id, { speed: value })}
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>0.25x</span>
          <span>4x</span>
        </div>
        <p className="text-[10px] text-slate-500">
          Timeline: {formatDuration(effectiveDuration(scene))} ({formatDuration(scene.duration)} at {(scene.speed ?? 1.0).toFixed(2)}x)
        </p>
      </div>

      {/* Camera Direction */}
      <div className="space-y-2">
        <Label htmlFor="camera-direction" className="text-slate-300">
          Camera Direction
        </Label>
        <Input
          id="camera-direction"
          value={scene.camera}
          onChange={(e) =>
            onUpdate(scene.id, { camera: e.target.value })
          }
          placeholder="e.g. Slow zoom in, eye level"
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Visual Description */}
      <div className="space-y-2">
        <Label htmlFor="visual-description" className="text-slate-300">
          Visual Description
        </Label>
        <Textarea
          id="visual-description"
          rows={4}
          value={scene.visual_description}
          onChange={(e) =>
            onUpdate(scene.id, { visual_description: e.target.value })
          }
          placeholder="Describe the visual for this scene..."
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
        />
      </div>

      {/* Text Overlay */}
      <div className="space-y-2">
        <Label htmlFor="narration" className="text-slate-300">
          Narration
        </Label>
        <Textarea
          id="narration"
          rows={3}
          value={scene.narration ?? ""}
          onChange={(e) =>
            onUpdate(scene.id, { narration: e.target.value })
          }
          placeholder="What the character says (drives TTS audio)..."
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
        />
      </div>


    </div>
  );
}
