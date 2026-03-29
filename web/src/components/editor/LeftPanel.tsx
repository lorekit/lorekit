"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ScrollText,
  SlidersHorizontal,
  Shuffle,
  Music,
  Image as ImageIcon,
  Save,
  Loader2,
  Upload,
  Volume2,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import type { Scene } from "@/lib/api";
import { clipUrl, updateProject } from "@/lib/api";
import { cn, BEAT_TEXT_COLORS, formatDuration } from "@/lib/utils";
import { SceneDetail } from "@/components/editor/SceneDetail";
import { TRANSITION_PILLS } from "@/components/editor/EditorTimeline";

/* ------------------------------------------------------------------ */
/*  Tab types                                                          */
/* ------------------------------------------------------------------ */

export type LeftPanelTab = "script" | "properties" | "transitions" | "audio" | "media";

const TABS: Array<{ key: LeftPanelTab; label: string; icon: React.ElementType }> = [
  { key: "properties", label: "Properties", icon: SlidersHorizontal },
  { key: "script", label: "Script", icon: ScrollText },
  { key: "transitions", label: "Transitions", icon: Shuffle },
  { key: "audio", label: "Audio", icon: Music },
  { key: "media", label: "Media", icon: ImageIcon },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface LeftPanelProps {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
  selectedScene: Scene | null;

  // Scene detail props
  characters?: Array<{ name: string; imageUrl: string | null }>;
  onUpdateScene: (sceneId: string, updates: Partial<Scene>) => void;
  onRegenerateClip: (sceneId: string) => void;
  isGenerating: boolean;

  // Transitions
  projectId: string;
  transitions: Record<number, string>;
  onTransitionChange: (sceneId: number, transition: string) => void;
  onSaveTransitions: () => void;
  transitionsDirty: boolean;
  transitionsSaving: boolean;

  // Audio
  audioMode?: string;
  audioFilename?: string;

  // Active tab (controlled)
  activeTab: LeftPanelTab;
  onTabChange: (tab: LeftPanelTab) => void;
}

/* ------------------------------------------------------------------ */
/*  Pill label map                                                     */
/* ------------------------------------------------------------------ */

const PILL_LABEL_MAP = Object.fromEntries(
  TRANSITION_PILLS.map((p) => [p.key, p.label])
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LeftPanel({
  scenes,
  selectedSceneId,
  onSelectScene,
  selectedScene,
  characters,
  onUpdateScene,
  onRegenerateClip,
  isGenerating,
  transitions,
  onTransitionChange,
  onSaveTransitions,
  transitionsDirty,
  transitionsSaving,
  audioMode,
  audioFilename,
  activeTab,
  onTabChange,
}: LeftPanelProps) {
  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Tab bar */}
      <div className="flex border-b border-slate-800 flex-shrink-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors whitespace-nowrap border-b-2",
              activeTab === tab.key
                ? "text-amber-400 border-amber-500 bg-amber-500/5"
                : "text-slate-400 border-transparent hover:text-slate-300 hover:bg-slate-900"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "script" && (
          <ScriptTab
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            onSelectScene={onSelectScene}
          />
        )}

        {activeTab === "properties" && (
          <div className="p-3">
            <SceneDetail
              scene={selectedScene}
              characters={characters}
              onUpdate={onUpdateScene}
              onRegenerate={onRegenerateClip}
              isGenerating={isGenerating}
            />
          </div>
        )}

        {activeTab === "transitions" && (
          <TransitionsTab
            scenes={scenes}
            transitions={transitions}
            onTransitionChange={onTransitionChange}
            onSave={onSaveTransitions}
            dirty={transitionsDirty}
            saving={transitionsSaving}
          />
        )}

        {activeTab === "audio" && (
          <AudioTab
            audioMode={audioMode}
            audioFilename={audioFilename}
          />
        )}

        {activeTab === "media" && (
          <MediaTab />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scenes Tab                                                         */
/* ------------------------------------------------------------------ */

function ScriptTab({
  scenes,
}: {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
}) {
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyToClipboard = useCallback(async (text: string, id?: string) => {
    await navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    }
  }, []);

  const fullScript = scenes
    .map((s, idx) => {
      const num = s.scene_id ?? idx + 1;
      const parts = [`Scene ${num} (${formatDuration(s.duration)})`];
      if (s.text_overlay) parts.push(`Text: "${s.text_overlay}"`);
      if (s.visual_description) parts.push(`Visual: ${s.visual_description}`);
      if (s.camera) parts.push(`Camera: ${s.camera}`);
      return parts.join("\n");
    })
    .join("\n\n");

  if (scenes.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-slate-500">
        No scenes yet
      </div>
    );
  }

  return (
    <div className="p-2">
      {/* Copy All button */}
      <button
        type="button"
        onClick={() => copyToClipboard(fullScript)}
        className="w-full flex items-center justify-center gap-2 mb-3 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
      >
        {copiedAll ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copiedAll ? "Copied!" : "Copy Full Script"}
      </button>

      <div className="space-y-1">
        {scenes.map((scene, idx) => {
          const sceneNum = scene.scene_id ?? idx + 1;
          const isExpanded = expandedIds.has(scene.id);
          const sceneText = [
            `Scene ${sceneNum} (${formatDuration(scene.duration)})`,
            scene.text_overlay ? `Text: "${scene.text_overlay}"` : "",
            scene.visual_description ? `Visual: ${scene.visual_description}` : "",
            scene.camera ? `Camera: ${scene.camera}` : "",
          ].filter(Boolean).join("\n");

          return (
            <div
              key={scene.id}
              className="rounded-lg border border-transparent bg-slate-900/50 hover:border-slate-700/50 transition-all"
            >
              {/* Header — click to expand/collapse */}
              <button
                type="button"
                onClick={() => toggleExpand(scene.id)}
                className="w-full text-left p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Scene {sceneNum}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">
                      {formatDuration(scene.duration)}
                    </span>
                    <ChevronDown className={cn(
                      "w-3 h-3 text-slate-500 transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  </div>
                </div>
                {scene.text_overlay && (
                  <p className="text-xs text-amber-300/80 italic mt-1 leading-relaxed line-clamp-1">
                    &ldquo;{scene.text_overlay}&rdquo;
                  </p>
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-2">
                  {scene.text_overlay && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">Text Overlay</p>
                      <p className="text-xs text-amber-300/80 italic leading-relaxed">
                        &ldquo;{scene.text_overlay}&rdquo;
                      </p>
                    </div>
                  )}
                  {scene.visual_description && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">Visual</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {scene.visual_description}
                      </p>
                    </div>
                  )}
                  {scene.camera && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">Camera</p>
                      <p className="text-[11px] text-slate-400">{scene.camera}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(sceneText, scene.id);
                    }}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {copiedId === scene.id ? (
                      <><Check className="w-3 h-3 text-green-400" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copy</>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



/* ------------------------------------------------------------------ */
/*  Transitions Tab                                                    */
/* ------------------------------------------------------------------ */

function TransitionsTab({
  scenes,
  transitions,
  onTransitionChange,
  onSave,
  dirty,
  saving,
}: {
  scenes: Scene[];
  transitions: Record<number, string>;
  onTransitionChange: (sceneId: number, transition: string) => void;
  onSave: () => void;
  dirty: boolean;
  saving: boolean;
}) {
  const [expandedBoundary, setExpandedBoundary] = useState<number | null>(null);

  if (scenes.length < 2) {
    return (
      <div className="p-4 text-center text-sm text-slate-500">
        Need at least 2 scenes for transitions
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {/* Save indicator */}
      {dirty && (
        <div className="flex items-center justify-end mb-1">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {/* Boundary list */}
      {scenes.slice(0, -1).map((scene, idx) => {
        const sceneNum = scene.scene_id ?? idx + 1;
        const nextScene = scenes[idx + 1];
        const nextSceneNum = nextScene.scene_id ?? idx + 2;
        const currentTransition = transitions[sceneNum] || "fade";
        const isExpanded = expandedBoundary === sceneNum;

        return (
          <div key={sceneNum} className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
            {/* Boundary header */}
            <button
              type="button"
              onClick={() => setExpandedBoundary(isExpanded ? null : sceneNum)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/50 transition-colors"
            >
              <span className="text-xs text-slate-300">
                Scene {sceneNum} → {nextSceneNum}
              </span>
              <span className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                "border-slate-600 bg-slate-800 text-slate-300"
              )}>
                {PILL_LABEL_MAP[currentTransition] || currentTransition}
              </span>
            </button>

            {/* Expanded: pill grid picker */}
            {isExpanded && (
              <div className="px-3 pb-3 border-t border-slate-800/50">
                <div className="flex flex-wrap gap-1 mt-2">
                  {TRANSITION_PILLS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onTransitionChange(sceneNum, key)}
                      className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-medium border transition-colors",
                        currentTransition === key
                          ? "border-amber-500 bg-amber-500/20 text-amber-300"
                          : "border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Audio Tab                                                          */
/* ------------------------------------------------------------------ */

function AudioTab({
  audioMode,
  audioFilename,
}: {
  audioMode?: string;
  audioFilename?: string;
}) {
  return (
    <div className="p-3 space-y-4">
      {/* Audio mode display */}
      <div>
        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          Audio Mode
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["auto", "narration", "uploaded", "silent"].map((mode) => (
            <div
              key={mode}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                audioMode === mode
                  ? "border-amber-500 bg-amber-500/10 text-amber-400"
                  : "border-slate-700 bg-slate-800/50 text-slate-400"
              )}
            >
              {mode === "uploaded" ? "Upload" : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Uploaded audio info + player */}
      {audioFilename && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 truncate">{audioFilename.split("/").pop()}</p>
              <p className="text-[10px] text-slate-500">Uploaded audio</p>
            </div>
          </div>
          <audio
            controls
            src={`http://localhost:8001/${audioFilename.replace(/^\.\//, "")}`}
            className="w-full h-8"
            style={{ colorScheme: "dark" }}
          />
        </div>
      )}

      {/* Upload placeholder — only if no audio uploaded */}
      {!audioFilename && (
        <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center">
          <Upload className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            Upload audio file
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            MP3, WAV, or M4A
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Media Tab (placeholder)                                            */
/* ------------------------------------------------------------------ */

function MediaTab() {
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full text-center">
      <ImageIcon className="w-8 h-8 text-slate-700 mb-3" />
      <p className="text-sm text-slate-500 font-medium">Media Library</p>
      <p className="text-xs text-slate-600 mt-1">Coming soon</p>
    </div>
  );
}
