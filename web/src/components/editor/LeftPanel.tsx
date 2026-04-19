"use client";

import React from "react";
import {
  Music,
  Image as ImageIcon,
  Upload,
  Volume2,
  Trash2,
  Clapperboard,
  Download,
  Type,
  Plus,
  Users,
} from "lucide-react";
import type { Scene, RenderRecord, TextItem } from "@/lib/api";
import { clipUrl, API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CharactersPanel } from "./CharactersPanel";

/* ------------------------------------------------------------------ */
/*  Tab types                                                          */
/* ------------------------------------------------------------------ */

export type LeftPanelTab = "media" | "audio" | "renders" | "text" | "characters";

const TABS: Array<{ key: LeftPanelTab; label: string; icon: React.ElementType }> = [
  { key: "characters", label: "Characters", icon: Users },
  { key: "media", label: "Media", icon: ImageIcon },
  { key: "audio", label: "Audio", icon: Music },
  { key: "renders", label: "Renders", icon: Clapperboard },
  { key: "text", label: "Text", icon: Type },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface LeftPanelProps {
  scenes: Scene[];

  // Audio
  audioFilename?: string;

  // Media
  characterPortraitUrl?: string | null;
  characterImages?: Array<{ url: string | null; path: string | null; label: string }>;

  // Active tab (controlled)
  activeTab: LeftPanelTab;
  onTabChange: (tab: LeftPanelTab) => void;

  // Render history
  renders?: RenderRecord[];
  onDownloadRender?: (path: string) => void;
  onDeleteRender?: (jobId: string) => void;

  // Text overlays
  textItems?: TextItem[];
  selectedTextId?: string | null;
  onSelectText?: (id: string) => void;
  onAddText?: () => void;
  onDeleteText?: (id: string) => void;

  // Characters
  universeId?: string;
  projectId?: string;
  characterId?: string;
  characterIdsJson?: string | null;
  onCharacterIdsChange?: (ids: string[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function LeftPanel({
  scenes,
  audioFilename,
  characterPortraitUrl,
  characterImages,
  activeTab,
  onTabChange,
  renders,
  onDownloadRender,
  onDeleteRender,
  textItems,
  selectedTextId,
  onSelectText,
  onAddText,
  onDeleteText,
  universeId,
  projectId,
  characterId,
  characterIdsJson,
  onCharacterIdsChange,
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
        {activeTab === "audio" && (
          <AudioTab
            audioFilename={audioFilename}
          />
        )}

        {activeTab === "media" && (
          <MediaTab
            scenes={scenes}
            characterPortraitUrl={characterPortraitUrl}
            characterImages={characterImages}
          />
        )}

        {activeTab === "renders" && (
          <RendersTab
            renders={renders}
            onDownload={onDownloadRender}
            onDelete={onDeleteRender}
          />
        )}

        {activeTab === "text" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Text Overlays</span>
              <button
                onClick={onAddText}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {(!textItems || textItems.length === 0) ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No text overlays yet.<br />Click + to add one.
              </div>
            ) : (
              <div className="space-y-1.5">
                {textItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectText?.(item.id)}
                    className={cn(
                      "rounded-lg border p-2.5 cursor-pointer transition-colors",
                      selectedTextId === item.id
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-200 truncate max-w-[200px]">
                        {item.text || "Empty text"}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteText?.(item.id); }}
                        className="text-slate-500 hover:text-red-400 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {(item.duration_frames / 30).toFixed(1)}s @ {(item.from_frame / 30).toFixed(1)}s
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "characters" && universeId && projectId && characterId && (
          <CharactersPanel
            universeId={universeId}
            projectId={projectId}
            characterId={characterId}
            characterIdsJson={characterIdsJson}
            onCharacterIdsChange={onCharacterIdsChange}
          />
        )}
      </div>
    </div>
  );
}

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
  characterImages,
}: {
  scenes: Scene[];
  characterPortraitUrl?: string | null;
  characterImages?: Array<{ url: string | null; path: string | null; label: string }>;
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
    (s.extracted_frames ?? [])
      .filter((f) => f.url || f.path)
      .map((f) => ({
        url: f.path ? `/files/${f.path}` : f.url!,
        label: `Scene ${s.scene_id ?? "?"} frame`,
      }))
  );

  // Collect character variations (reference images from scenes)
  const characterVariations: Array<{ url: string; label: string }> = [];
  for (const s of scenes) {
    for (const ref of s.reference_images ?? []) {
      const refUrl = typeof ref === "string" ? ref : ref.url || ref.path;
      if (refUrl && !seen.has(refUrl)) {
        seen.add(refUrl);
        characterVariations.push({
          url: refUrl.startsWith("/files/") ? refUrl : `/files/${refUrl}`,
          label: `Scene ${s.scene_id ?? "?"}`,
        });
      }
    }
  }

  // Merge character images from API
  const charImgs = (characterImages ?? []).filter((img) => img.url || img.path);

  const hasAny = !!(charImgs.length || allKeyframes.length || extractedFrames.length || characterVariations.length);

  const resolveImgSrc = (img: { url: string | null; path: string | null }) => {
    const raw = img.path || img.url || "";
    if (raw.startsWith("http")) return raw;
    const normalized = raw.startsWith("/") ? raw : `/${raw}`;
    return clipUrl(normalized.startsWith("/files/") ? normalized : `/files${normalized}`);
  };

  return (
    <div className="p-3 space-y-4 overflow-y-auto">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        Media Gallery
      </p>
      <p className="text-[11px] text-slate-500">
        Drag images onto the canvas to use them as reference nodes.
      </p>

      {!hasAny && (
        <div className="py-8 text-center">
          <ImageIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No images available yet.</p>
          <p className="text-[10px] text-slate-600 mt-1">Generate keyframes to get started.</p>
        </div>
      )}

      {charImgs.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Character Images</p>
          <div className="grid grid-cols-3 gap-1.5">
            {charImgs.map((img, idx) => {
              const src = resolveImgSrc(img);
              const dragUrl = img.path || img.url || "";
              return (
                <div
                  key={`char-${idx}`}
                  className="relative rounded-lg overflow-hidden border border-slate-800 cursor-grab active:cursor-grabbing hover:border-amber-500/50 transition-colors"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/workflow-image", JSON.stringify({
                      type: "character_ref",
                      image_url: dragUrl,
                      label: img.label || `Ref ${idx + 1}`,
                    }));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <img
                    src={src}
                    alt={img.label}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                    <span className="text-[9px] text-white/80">{img.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {characterVariations.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">Character Variations</p>
          <div className="grid grid-cols-3 gap-1.5">
            {characterVariations.map(({ url, label }, idx) => (
              <div key={`cv-${idx}`} className="relative rounded-lg overflow-hidden border border-slate-800">
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


/* ------------------------------------------------------------------ */
/*  Renders Tab                                                        */
/* ------------------------------------------------------------------ */

function RendersTab({
  renders,
  onDownload,
  onDelete,
}: {
  renders?: RenderRecord[];
  onDownload?: (path: string) => void;
  onDelete?: (jobId: string) => void;
}) {
  if (!renders || renders.length === 0) {
    return (
      <div className="p-4 text-center">
        <Clapperboard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No renders yet</p>
        <p className="text-xs text-slate-600 mt-1">Render your video to see it here</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium px-1">
        Render History ({renders.length})
      </p>
      {renders.map((render) => {
        const date = render.created_at ? new Date(render.created_at) : null;
        const displayPath = render.history_path || render.output_path;
        return (
          <div
            key={render.id}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 space-y-2"
          >
            {/* Preview thumbnail */}
            {displayPath && (
              <div className="relative bg-black rounded overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <video
                  src={clipUrl(`/files/${displayPath}`)}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                  crossOrigin="anonymous"
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300">
                  {date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Render"}
                </p>
                {render.timestamp && (
                  <p className="text-[10px] text-slate-500">{render.timestamp}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {displayPath && onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(displayPath)}
                    className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(render.id)}
                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
