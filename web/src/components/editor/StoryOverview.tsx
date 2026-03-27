"use client";

import React, { useState, useCallback } from "react";
import { ArrowDown, Clock, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import type { Scene } from "@/lib/api";
import { cn, BEAT_COLORS, BEAT_TEXT_COLORS, formatDuration } from "@/lib/utils";

interface StoryOverviewProps {
  scenes: Scene[];
  totalDuration: number;
}

function useCopyFeedback() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return { copiedId, copy };
}

function formatSceneText(scene: Scene, index: number): string {
  const parts: string[] = [];
  parts.push(`Scene ${index + 1}: ${scene.beat.toUpperCase()} (${formatDuration(scene.duration)})`);
  parts.push(`Visual: ${scene.visual_description}`);
  if (scene.camera) parts.push(`Camera: ${scene.camera}`);
  if (scene.text_overlay) parts.push(`Text: ${scene.text_overlay}`);
  return parts.join("\n");
}

function formatAllScenes(scenes: Scene[]): string {
  return scenes
    .map((scene, i) => formatSceneText(scene, i))
    .join("\n\n---\n\n");
}

export function StoryOverview({ scenes, totalDuration }: StoryOverviewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const { copiedId, copy } = useCopyFeedback();

  const toggleScene = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setAllExpanded(false);
    } else {
      setExpandedIds(new Set(scenes.map((s) => s.id)));
      setAllExpanded(true);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Story Arc</h3>
        <div className="flex items-center gap-2">
          {/* Copy All */}
          <button
            onClick={() => copy(formatAllScenes(scenes), "__all__")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/50"
            title="Copy all scenes"
          >
            {copiedId === "__all__" ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copiedId === "__all__" ? "Copied!" : "Copy All"}
          </button>

          {/* Expand/Collapse All */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/50"
          >
            {allExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {allExpanded ? "Collapse" : "Expand All"}
          </button>

          {/* Duration badge */}
          <div className="flex items-center gap-1.5 bg-slate-800 rounded-full px-3 py-1 border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">
              {formatDuration(totalDuration)}
            </span>
          </div>
        </div>
      </div>

      {/* Arc flow */}
      {scenes.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          No scenes in this story yet
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0">
          {scenes.map((scene, index) => {
            const isExpanded = expandedIds.has(scene.id);
            const sceneKey = `scene-${index}`;

            return (
              <React.Fragment key={scene.id}>
                {/* Scene card */}
                <div className="w-full max-w-lg">
                  <div className="relative bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600 transition-colors">
                    {/* Beat indicator dot */}
                    <div className="absolute -left-3 top-5 -translate-y-1/2">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full border-2 border-slate-900 shadow-lg flex items-center justify-center",
                          BEAT_COLORS[scene.beat]
                        )}
                      >
                        <span className="text-[8px] font-bold text-white">
                          {index + 1}
                        </span>
                      </div>
                    </div>

                    {/* Header — always visible, clickable */}
                    <button
                      onClick={() => toggleScene(scene.id)}
                      className="w-full text-left ml-2"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              BEAT_TEXT_COLORS[scene.beat]
                            )}
                          >
                            {scene.beat}
                          </span>
                          {scene.cta_scene && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 border border-pink-500/30">
                              CTA
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-mono">
                            {formatDuration(scene.duration)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </div>
                      </div>

                      {/* Preview text — collapsed */}
                      {!isExpanded && (
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                          {scene.visual_description || "No description"}
                        </p>
                      )}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="ml-2 mt-1 space-y-3">
                        {/* Visual description */}
                        <div>
                          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                            Visual
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {scene.visual_description}
                          </p>
                        </div>

                        {/* Camera */}
                        {scene.camera && (
                          <div>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                              Camera
                            </p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {scene.camera}
                            </p>
                          </div>
                        )}

                        {/* Text overlay */}
                        {scene.text_overlay && (
                          <div>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                              Text Overlay
                            </p>
                            <p className="text-xs text-amber-400/80 italic leading-relaxed">
                              &ldquo;{scene.text_overlay}&rdquo;
                            </p>
                          </div>
                        )}

                        {/* Copy this scene */}
                        <div className="pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copy(formatSceneText(scene, index), sceneKey);
                            }}
                            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {copiedId === sceneKey ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copiedId === sceneKey ? "Copied!" : "Copy scene"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector arrow */}
                {index < scenes.length - 1 && (
                  <div className="flex flex-col items-center py-1">
                    <div className="w-px h-3 bg-slate-700" />
                    <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
