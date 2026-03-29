"use client";

import React from "react";
import { RotateCcw, Quote, Loader2 } from "lucide-react";
import type { Scene } from "@/lib/api";
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
      {/* Characters in this scene */}
      {characters && characters.length > 0 && (
        <div className="space-y-2">
          <Label className="text-slate-500 text-xs uppercase tracking-wider">Characters</Label>
          <div className="flex gap-3">
            {characters.map((char) => (
              <div key={char.name} className="flex items-center gap-2.5 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50">
                {char.imageUrl ? (
                  <img
                    src={char.imageUrl}
                    alt={char.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-600"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 text-lg">
                    🏛️
                  </div>
                )}
                <span className="text-sm text-slate-300 font-medium">{char.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Character Present toggle */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
        <div>
          <p className="text-sm text-slate-300 font-medium">Character in Scene</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {scene.character_present
              ? "Character portrait will be composited into keyframe & video"
              : "Environment only — no character injection"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUpdate(scene.id, { character_present: !scene.character_present })}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
            scene.character_present ? "bg-amber-500" : "bg-slate-600"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white transition-transform",
              scene.character_present ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="duration" className="text-slate-300">
            Duration
          </Label>
          <span className="text-sm font-mono text-amber-400">
            {formatDuration(scene.duration)}
          </span>
        </div>
        <Slider
          id="duration"
          min={1}
          max={15}
          step={0.5}
          value={scene.duration}
          onChange={(value) => onUpdate(scene.id, { duration: value })}
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>1s</span>
          <span>15s</span>
        </div>
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
        <Label htmlFor="text-overlay" className="text-slate-300">
          Text Overlay
        </Label>
        <Textarea
          id="text-overlay"
          rows={3}
          value={scene.text_overlay ?? ""}
          onChange={(e) =>
            onUpdate(scene.id, { text_overlay: e.target.value })
          }
          placeholder="Text to display on screen..."
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
        />
      </div>


    </div>
  );
}
