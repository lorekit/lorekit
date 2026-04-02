"use client";

import React from "react";
import type { Transition } from "@/lib/api";
import { effectiveDuration } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

interface TransitionDetailProps {
  transition: Transition | null;
  onUpdate: (fromSceneId: number, toSceneId: number, updates: Partial<Transition>) => void;
}

export function TransitionDetail({
  transition,
  onUpdate,
}: TransitionDetailProps) {
  if (!transition) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Select a transition to edit
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <h3 className="text-sm font-medium text-slate-300">
        Transition {transition.from_scene_id} → {transition.to_scene_id}
      </h3>

      {/* Prompt */}
      <div className="space-y-2">
        <Label htmlFor="trans-prompt" className="text-slate-300">
          Prompt
        </Label>
        <Textarea
          id="trans-prompt"
          rows={3}
          value={transition.prompt}
          onChange={(e) =>
            onUpdate(transition.from_scene_id, transition.to_scene_id, { prompt: e.target.value })
          }
          placeholder="Describe the visual transition..."
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
        />
      </div>

      {/* Clip Length */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="trans-duration" className="text-slate-300">
            Clip Length
          </Label>
          <span className="text-sm font-mono text-amber-400">
            {formatDuration(transition.duration)}
          </span>
        </div>
        <Slider
          id="trans-duration"
          min={3}
          max={15}
          step={0.5}
          value={transition.duration}
          onChange={(value) =>
            onUpdate(transition.from_scene_id, transition.to_scene_id, { duration: value })
          }
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>3s</span>
          <span>15s</span>
        </div>
      </div>

      {/* Speed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="trans-speed" className="text-slate-300">
            Speed
          </Label>
          <span className="text-sm font-mono text-cyan-400">
            {transition.speed.toFixed(2)}x
          </span>
        </div>
        <Slider
          id="trans-speed"
          min={0.25}
          max={4}
          step={0.25}
          value={transition.speed}
          onChange={(value) =>
            onUpdate(transition.from_scene_id, transition.to_scene_id, { speed: value })
          }
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>0.25x</span>
          <span>4x</span>
        </div>
        <p className="text-[10px] text-slate-500">
          Timeline: {formatDuration(effectiveDuration(transition))} ({formatDuration(transition.duration)} at {transition.speed.toFixed(2)}x)
        </p>
      </div>
    </div>
  );
}
