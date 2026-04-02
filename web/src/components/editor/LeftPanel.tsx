"use client";

import React, { useState, useCallback } from "react";
import {
  ScrollText,
  SlidersHorizontal,
  Music,
  Image as ImageIcon,
  Upload,
  Volume2,
  Copy,
  Check,
  ChevronDown,
  Trash2,
} from "lucide-react";
import type { Scene, Transition } from "@/lib/api";
import { clipUrl, API_BASE } from "@/lib/api";
import { cn, BEAT_TEXT_COLORS, formatDuration } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Tab types                                                          */
/* ------------------------------------------------------------------ */

export type LeftPanelTab = "script" | "audio" | "media";

const TABS: Array<{ key: LeftPanelTab; label: string; icon: React.ElementType }> = [
  { key: "script", label: "Script", icon: ScrollText },
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

  // Transitions
  selectedTransition?: Transition | null;
  onSelectTransition?: (fromSceneId: number, toSceneId: number) => void;
  transitionClips?: Record<string, { clip_path?: string; prompt?: string }>;

  // Scene/transition deletion
  onDeleteScene?: (sceneId: string, sceneNum: number) => void;
  onDeleteTransition?: (fromSceneId: number, toSceneId: number) => void;

  // Characters (for script tab display)
  characters?: Array<{ name: string; imageUrl: string | null }>;

  // Audio
  audioFilename?: string;

  // Media
  characterPortraitUrl?: string | null;

  // Active tab (controlled)
  activeTab: LeftPanelTab;
  onTabChange: (tab: LeftPanelTab) => void;

  // View properties callback (switches to right panel)
  onViewProperties?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LeftPanel({
  scenes,
  selectedSceneId,
  onSelectScene,
  characters,
  onDeleteScene,
  onDeleteTransition,
  selectedTransition,
  onSelectTransition,
  transitionClips,
  audioFilename,
  characterPortraitUrl,
  activeTab,
  onTabChange,
  onViewProperties,
}: LeftPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-slate-800/50 flex-shrink-0 overflow-x-auto">
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
            selectedTransition={selectedTransition}
            onSelectScene={onSelectScene}
            onSelectTransition={onSelectTransition}
            onDeleteScene={onDeleteScene}
            onDeleteTransition={onDeleteTransition}
            onViewProperties={onViewProperties}
            characters={characters}
            transitionClips={transitionClips}
          />
        )}

        {activeTab === "audio" && (
          <AudioTab
            audioFilename={audioFilename}
          />
        )}

        {activeTab === "media" && (
          <MediaTab
            scenes={scenes}
            characterPortraitUrl={characterPortraitUrl}
          />
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
  selectedSceneId,
  selectedTransition,
  onSelectScene,
  onSelectTransition,
  onDeleteScene,
  onDeleteTransition,
  onViewProperties,
  characters,
  transitionClips,
}: {
  scenes: Scene[];
  selectedSceneId: string | null;
  selectedTransition?: Transition | null;
  onSelectScene: (id: string) => void;
  onSelectTransition?: (fromSceneId: number, toSceneId: number) => void;
  onDeleteScene?: (sceneId: string, sceneNum: number) => void;
  onDeleteTransition?: (fromSceneId: number, toSceneId: number) => void;
  onViewProperties?: () => void;
  characters?: Array<{ name: string; imageUrl: string | null }>;
  transitionClips?: Record<string, { clip_path?: string; prompt?: string }>;
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

  // Only show beat badges when scenes have varied beats (not all IMPACT, etc.)
  const showBeats = new Set(scenes.map(s => s.beat).filter(Boolean)).size > 1;

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
      {/* Characters */}
      {characters && characters.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Characters</p>
          <div className="flex gap-2 flex-wrap">
            {characters.map((char) => (
              <div key={char.name} className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-2.5 py-1.5 border border-slate-700/50">
                {char.imageUrl ? (
                  <img src={char.imageUrl} alt={char.name} className="w-7 h-7 rounded object-cover border border-slate-600" />
                ) : (
                  <div className="w-7 h-7 rounded bg-slate-700 flex items-center justify-center text-slate-500 text-xs">?</div>
                )}
                <span className="text-xs text-slate-300 font-medium">{char.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Copy All button */}
      <button
        type="button"
        onClick={() => copyToClipboard(fullScript)}
        className="w-full flex items-center justify-center gap-2 mb-3 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
      >
        {copiedAll ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copiedAll ? "Copied!" : "Copy Full Script"}
      </button>

      <div className="space-y-1.5">
        {scenes.map((scene, idx) => {
          const sceneNum = scene.scene_id ?? idx + 1;
          const isExpanded = expandedIds.has(scene.id);
          const sceneText = [
            `Scene ${sceneNum} (${formatDuration(scene.duration)})`,
            scene.text_overlay ? `Text: "${scene.text_overlay}"` : "",
            scene.visual_description ? `Visual: ${scene.visual_description}` : "",
            scene.camera ? `Camera: ${scene.camera}` : "",
          ].filter(Boolean).join("\n");

          const isSelected = scene.id === selectedSceneId;

          return (
            <React.Fragment key={scene.id}>
            <div
              onClick={() => { onSelectScene(scene.id); toggleExpand(scene.id); }}
              className={cn(
                "rounded-lg border transition-all border-l-2 cursor-pointer",
                isSelected
                  ? "border-amber-500/70 bg-amber-500/10 border-l-amber-500"
                  : "border-slate-700/50 bg-slate-900 hover:border-slate-600 border-l-amber-500/60"
              )}
            >
              {/* Header row */}
              <div className="flex items-center p-2.5 gap-2 group/scene">
                {/* Keyframe thumbnail */}
                {scene.keyframe_url ? (
                  <img
                    src={clipUrl(scene.keyframe_url)}
                    alt=""
                    className="w-8 h-12 rounded object-cover border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-12 rounded bg-slate-800 border border-slate-700 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Scene {sceneNum}
                    </span>
                    {showBeats && scene.beat && (
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full border font-medium uppercase",
                        BEAT_TEXT_COLORS[scene.beat] || "bg-slate-800 text-slate-400 border-slate-700"
                      )}>
                        {scene.beat}
                      </span>
                    )}
                    {/* Clip status dot */}
                    <span className={cn("w-1.5 h-1.5 rounded-full", scene.clip_url ? "bg-emerald-500" : "bg-slate-600")} title={scene.clip_url ? "Clip generated" : "No clip yet"} />
                    <span className="ml-auto text-[10px] text-slate-500 shrink-0">
                      {formatDuration(scene.duration)}
                    </span>
                    <ChevronDown className={cn(
                      "w-3 h-3 text-slate-500 transition-transform shrink-0",
                      isExpanded && "rotate-180"
                    )} />
                  </div>
                  {onViewProperties && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onViewProperties(); }}
                      className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors mt-1"
                    >
                      <SlidersHorizontal className="w-3 h-3" /> View Properties
                    </button>
                  )}
                </div>

                {/* Delete button — hover only */}
                {onDeleteScene && scenes.length > 2 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteScene(scene.id, sceneNum);
                    }}
                    className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover/scene:opacity-100 transition-all cursor-pointer shrink-0"
                    title="Delete scene"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

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
                  {onViewProperties && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onViewProperties(); }}
                      className="flex items-center gap-1 text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors"
                    >
                      <SlidersHorizontal className="w-3 h-3" /> View Properties
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Transition row between scenes */}
            {idx < scenes.length - 1 && (() => {
              const nextScene = scenes[idx + 1];
              const nextSceneNum = nextScene.scene_id ?? idx + 2;
              const transKey = `${sceneNum}_${nextSceneNum}`;
              const transClip = transitionClips?.[transKey];
              const hasClip = !!transClip?.clip_path;
              const bothClipsExist = !!scene.clip_url && !!nextScene.clip_url;

              const isTransSelected = selectedTransition?.from_scene_id === sceneNum && selectedTransition?.to_scene_id === nextSceneNum;

              return (
                <div
                  onClick={() => bothClipsExist && onSelectTransition?.(sceneNum, nextSceneNum)}
                  className={cn(
                    "group/trans rounded-lg border px-2.5 py-2 flex items-center justify-between ml-4 my-1 border-l-2",
                    bothClipsExist && "cursor-pointer",
                    isTransSelected
                      ? "border-amber-500/70 bg-amber-500/10 border-l-amber-500"
                      : hasClip
                      ? "border-emerald-500/30 bg-emerald-900/20 border-l-emerald-500/60"
                      : "border-dashed border-slate-600 bg-slate-800/50 border-l-violet-500/40"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-slate-500">
                      Transition {sceneNum} → {nextSceneNum}
                    </span>
                    {bothClipsExist && onViewProperties ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelectTransition?.(sceneNum, nextSceneNum); onViewProperties(); }}
                        className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors mt-0.5"
                      >
                        <SlidersHorizontal className="w-3 h-3" /> View Properties
                      </button>
                    ) : !bothClipsExist ? (
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Generate both clips first
                      </p>
                    ) : null}
                  </div>
                  {hasClip && onDeleteTransition && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTransition(sceneNum, nextSceneNum);
                      }}
                      className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover/trans:opacity-100 transition-all cursor-pointer shrink-0"
                      title="Remove transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })()}
          </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Audio Tab                                                          */
/* ------------------------------------------------------------------ */

function AudioTab({
  audioFilename,
}: {
  audioFilename?: string;
}) {
  return (
    <div className="p-3 space-y-4">
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
            src={`${API_BASE}/files/${audioFilename}`}
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
/*  Media Tab — Image Gallery (display-only)                            */
/* ------------------------------------------------------------------ */

function MediaTab({
  scenes,
  characterPortraitUrl,
}: {
  scenes: Scene[];
  characterPortraitUrl?: string | null;
}) {
  // Collect all keyframes (current + history), deduplicated
  const seen = new Set<string>();
  const allKeyframes: Array<{ url: string; label: string; active: boolean }> = [];

  for (const s of scenes) {
    const displayUrl = s.keyframe_path ? `/files/${s.keyframe_path}` : s.keyframe_url;
    if (displayUrl && !seen.has(displayUrl)) {
      seen.add(displayUrl);
      allKeyframes.push({ url: displayUrl, label: `Scene ${s.scene_id ?? "?"}`, active: true });
    }
    for (const h of s.keyframe_history ?? []) {
      const hUrl = h.path ? `/files/${h.path}` : h.url;
      if (hUrl && !seen.has(hUrl)) {
        seen.add(hUrl);
        allKeyframes.push({ url: hUrl, label: `Scene ${s.scene_id ?? "?"}`, active: false });
      }
    }
  }

  const extractedFrames = scenes.flatMap((s) =>
    (s.extracted_frames ?? []).map((f) => ({
      url: f.url,
      label: `Scene ${s.scene_id ?? "?"} @ ${f.timestamp.toFixed(1)}s`,
    }))
  );

  const hasAny = !!(characterPortraitUrl || allKeyframes.length || extractedFrames.length);

  return (
    <div className="p-3 space-y-4 overflow-y-auto">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        Media Gallery
      </p>
      <p className="text-[11px] text-slate-500">
        All generated keyframes, extracted frames, and character images. Use the Keyframe tab to select reference images per scene.
      </p>

      {!hasAny && (
        <div className="py-8 text-center">
          <ImageIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No images available yet.</p>
          <p className="text-[10px] text-slate-600 mt-1">Generate keyframes to get started.</p>
        </div>
      )}

      {characterPortraitUrl && (
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Character Portrait</p>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="relative rounded-lg overflow-hidden border border-slate-800">
              <img
                src={characterPortraitUrl.startsWith("http") ? characterPortraitUrl : clipUrl(characterPortraitUrl)}
                alt="Portrait"
                className="w-full aspect-[9/16] object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                <span className="text-[9px] text-white/80">Portrait</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {allKeyframes.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Scene Keyframes</p>
          <div className="grid grid-cols-3 gap-1.5">
            {allKeyframes.map(({ url, label, active }, idx) => (
              <div key={`kf-${idx}`} className="relative rounded-lg overflow-hidden border border-slate-800">
                <img
                  src={url.startsWith("http") ? url : clipUrl(url)}
                  alt={label}
                  className="w-full aspect-[9/16] object-cover"
                />
                {active && (
                  <span className="absolute top-1 left-1 text-[7px] bg-emerald-600/90 text-white px-1 rounded">
                    Active
                  </span>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                  <span className="text-[9px] text-white/80">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {extractedFrames.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Extracted Frames</p>
          <div className="grid grid-cols-3 gap-1.5">
            {extractedFrames.map(({ url, label }, idx) => (
              <div key={`ef-${idx}`} className="relative rounded-lg overflow-hidden border border-slate-800">
                <img
                  src={url.startsWith("http") ? url : clipUrl(url)}
                  alt={label}
                  className="w-full aspect-[9/16] object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                  <span className="text-[9px] text-white/80">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Character source ref photos excluded — they skew keyframe generation */}
    </div>
  );
}
