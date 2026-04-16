"use client";

import React, { useCallback, useState } from "react";
import {
  Image as ImageIcon,
  Film,
  Volume2,
  Terminal,
  Shuffle,
  Clapperboard,
  Check,
  X,
  Pencil,
  Copy,
  ExternalLink,
  RotateCcw,
  Play,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflow-store";
import { clipUrl } from "@/lib/api";
import type { WorkflowNode } from "@/lib/api";
import { Slider } from "@/components/ui/slider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryIcon(type: string) {
  if (type === "scene" || type === "transition") return Clapperboard;
  if (type.includes("image") || type.includes("keyframe") || type.includes("kontext")) return ImageIcon;
  if (type.includes("video") || type.includes("kling")) return Film;
  if (type.includes("audio") || type.includes("tts")) return Volume2;
  if (type.includes("ffmpeg") || type.includes("render")) return Terminal;
  return Shuffle;
}

function getCategoryColor(type: string) {
  if (type === "scene" || type === "transition") return "text-cyan-400";
  if (type.includes("image") || type.includes("keyframe") || type.includes("kontext")) return "text-blue-400";
  if (type.includes("video") || type.includes("kling")) return "text-purple-400";
  if (type.includes("audio") || type.includes("tts")) return "text-emerald-400";
  if (type.includes("ffmpeg") || type.includes("render")) return "text-orange-400";
  return "text-amber-400";
}

const STATUS_LABELS: Record<WorkflowNode["status"], { text: string; color: string }> = {
  pending: { text: "Pending", color: "text-slate-400" },
  running: { text: "Running", color: "text-blue-400" },
  completed: { text: "Completed", color: "text-emerald-400" },
  failed: { text: "Failed", color: "text-red-400" },
  skipped: { text: "Skipped", color: "text-slate-500" },
};

// ---------------------------------------------------------------------------
// Scene Inspector — same fields as old SceneDetail
// ---------------------------------------------------------------------------

function SceneInspector({ node }: { node: WorkflowNode }) {
  const { updateNodeParams } = useWorkflowStore();
  const p = node.params;

  const update = (key: string, value: any) => updateNodeParams(node.id, { [key]: value });

  const duration = p.duration ?? 5;
  const speed = p.speed ?? 1.0;
  const effectiveDuration = duration / speed;

  return (
    <div className="space-y-4">
      {/* Beat badge */}
      {p.beat && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
            {p.beat}
          </span>
          {p.scene_id && (
            <span className="text-xs text-slate-500">Scene {p.scene_id}</span>
          )}
        </div>
      )}

      {/* Clip Length */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">Clip Length</label>
          <span className="text-xs font-bold text-amber-400">{duration}s</span>
        </div>
        <Slider
          value={duration}
          min={3}
          max={15}
          step={1}
          onChange={(v) => update("duration", v)}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-600">3s</span>
          <span className="text-[10px] text-slate-600">15s</span>
        </div>
      </div>

      {/* Speed */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">Speed</label>
          <span className="text-xs font-bold text-amber-400">{speed.toFixed(2)}x</span>
        </div>
        <Slider
          value={speed}
          min={0.25}
          max={4}
          step={0.05}
          onChange={(v) => update("speed", Math.round(v * 100) / 100)}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-600">0.25x</span>
          <span className="text-[10px] text-slate-600">4x</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          Timeline: {effectiveDuration.toFixed(1)}s ({duration}s at {speed.toFixed(2)}x)
        </p>
      </div>

      {/* Camera Direction */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Camera Direction</label>
        <input
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500"
          value={p.camera ?? ""}
          onChange={(e) => update("camera", e.target.value)}
          placeholder="Camera movement description..."
        />
      </div>

      {/* Visual Description */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Visual Description</label>
        <textarea
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 resize-none"
          rows={5}
          value={p.visual_description ?? ""}
          onChange={(e) => update("visual_description", e.target.value)}
          placeholder="What the AI should generate..."
        />
      </div>

      {/* Text Overlay */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Text Overlay</label>
        <textarea
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 resize-none"
          rows={2}
          value={p.text_overlay ?? ""}
          onChange={(e) => update("text_overlay", e.target.value)}
          placeholder="Text to display on screen..."
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generation Inspector — status, preview, retry
// ---------------------------------------------------------------------------

function GenerationInspector({ node }: { node: WorkflowNode }) {
  const statusInfo = STATUS_LABELS[node.status];

  // Find output URL for preview
  const outputUrl = Object.values(node.outputs).find(
    (v) => typeof v === "string" && (v.startsWith("http") || v.endsWith(".png") || v.endsWith(".jpg") || v.endsWith(".mp4"))
  ) as string | undefined;

  const isVideo = outputUrl?.endsWith(".mp4");

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-medium", statusInfo.color)}>
          {statusInfo.text}
        </span>
        {node.cost > 0 && (
          <span className="text-xs text-slate-500">{node.cost.toFixed(2)} credits</span>
        )}
      </div>

      {node.error && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{node.error}</p>
        </div>
      )}

      {/* Output Preview */}
      {outputUrl && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Output</label>
          {isVideo ? (
            <video
              src={clipUrl(outputUrl)}
              controls
              className="w-full rounded-lg border border-slate-700"
            />
          ) : (
            <img
              src={clipUrl(outputUrl)}
              alt="Output"
              className="w-full rounded-lg border border-slate-700"
            />
          )}
          <div className="flex items-center gap-2 mt-2">
            <a
              href={clipUrl(outputUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(outputUrl)}
              className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy URL
            </button>
          </div>
        </div>
      )}

      {/* Params (read-only for gen nodes) */}
      {Object.keys(node.params).length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Parameters</label>
          <div className="space-y-1">
            {Object.entries(node.params).map(([key, value]) => (
              <div key={key} className="text-[11px]">
                <span className="text-slate-500 font-mono">{key}: </span>
                <span className="text-slate-400">
                  {typeof value === "string"
                    ? value.length > 80 ? value.slice(0, 80) + "..." : value
                    : JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transition Inspector
// ---------------------------------------------------------------------------

function TransitionInspector({ node }: { node: WorkflowNode }) {
  const { updateNodeParams } = useWorkflowStore();
  const p = node.params;
  const update = (key: string, value: any) => updateNodeParams(node.id, { [key]: value });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Transition Prompt</label>
        <textarea
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 resize-none"
          rows={3}
          value={p.prompt ?? ""}
          onChange={(e) => update("prompt", e.target.value)}
          placeholder="How the camera/visual morphs between scenes..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">Duration</label>
          <span className="text-xs font-bold text-amber-400">{p.duration ?? 3}s</span>
        </div>
        <Slider
          value={p.duration ?? 3}
          min={3}
          max={15}
          step={1}
          onChange={(v) => update("duration", v)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">Speed</label>
          <span className="text-xs font-bold text-amber-400">{(p.speed ?? 1.0).toFixed(2)}x</span>
        </div>
        <Slider
          value={p.speed ?? 1.0}
          min={0.25}
          max={4}
          step={0.05}
          onChange={(v) => update("speed", Math.round(v * 100) / 100)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic Param Inspector (for all other node types)
// ---------------------------------------------------------------------------

function GenericParamInspector({ node }: { node: WorkflowNode }) {
  const { updateNodeParams } = useWorkflowStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const handleSave = (key: string) => {
    let value: any = draft;
    try { value = JSON.parse(draft); } catch { /* keep as string */ }
    updateNodeParams(node.id, { [key]: value });
    setEditingKey(null);
  };

  if (Object.keys(node.params).length === 0) {
    return <p className="text-xs text-slate-600 italic">No parameters</p>;
  }

  return (
    <div className="space-y-2">
      {Object.entries(node.params).map(([key, value]) => (
        <div key={key} className="group">
          <label className="text-[11px] text-slate-500 font-mono block mb-0.5">{key}</label>
          {editingKey === key ? (
            <div className="flex items-center gap-1">
              <textarea
                autoFocus
                className="flex-1 bg-slate-800 text-xs text-slate-300 px-2 py-1 rounded border border-slate-700 outline-none focus:border-amber-500 resize-none"
                rows={typeof value === "string" && value.length > 60 ? 3 : 1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(key); }
                  if (e.key === "Escape") setEditingKey(null);
                }}
              />
              <button onClick={() => handleSave(key)} className="text-emerald-400 hover:text-emerald-300 shrink-0">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditingKey(null)} className="text-slate-500 hover:text-slate-300 shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              className="flex items-start gap-1 cursor-pointer hover:bg-slate-800/50 rounded px-1 py-0.5 -mx-1"
              onClick={() => {
                setEditingKey(key);
                setDraft(typeof value === "string" ? value : JSON.stringify(value, null, 2));
              }}
            >
              <p className="text-xs text-slate-300 break-all flex-1">
                {typeof value === "string"
                  ? value.length > 100 ? value.slice(0, 100) + "..." : value
                  : JSON.stringify(value)}
              </p>
              <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Inspector Component
// ---------------------------------------------------------------------------

export function NodeInspector() {
  const { workflow, selectedNodeId, updateNodeLabel } = useWorkflowStore();
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  const node = selectedNodeId && workflow ? workflow.nodes[selectedNodeId] : null;

  const handleLabelSave = useCallback(() => {
    if (node && labelDraft.trim()) {
      updateNodeLabel(node.id, labelDraft.trim());
    }
    setEditingLabel(false);
  }, [node, labelDraft, updateNodeLabel]);

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 px-6">
        <Clapperboard className="w-8 h-8 mb-3 text-slate-600" />
        <p className="text-sm text-center">Select a node to inspect its properties</p>
      </div>
    );
  }

  const IconComponent = getCategoryIcon(node.type);
  const categoryColor = getCategoryColor(node.type);
  const isScene = node.type === "scene";
  const isTransition = node.type === "transition";
  const isGeneration = ["kontext_keyframe", "nano_banana", "kling_v3_pro", "kling_o3", "tts_minimax", "tts_orpheus", "tts_elevenlabs"].includes(node.type);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <IconComponent className={cn("w-4 h-4", categoryColor)} />
          {editingLabel ? (
            <div className="flex-1 flex items-center gap-1">
              <input
                autoFocus
                className="flex-1 bg-slate-800 text-sm text-slate-200 px-2 py-0.5 rounded border border-slate-700 outline-none focus:border-amber-500"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLabelSave();
                  if (e.key === "Escape") setEditingLabel(false);
                }}
                onBlur={handleLabelSave}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium text-slate-200 truncate">{node.label}</span>
              <button
                onClick={() => { setLabelDraft(node.label); setEditingLabel(true); }}
                className="text-slate-500 hover:text-slate-300 shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500 font-mono">{node.type}</p>
      </div>

      {/* Type-specific content */}
      <div className="px-4 py-3">
        {isScene ? (
          <SceneInspector node={node} />
        ) : isTransition ? (
          <TransitionInspector node={node} />
        ) : isGeneration ? (
          <GenerationInspector node={node} />
        ) : (
          <>
            {/* Status for non-scene nodes */}
            <div className="mb-4">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Status</h3>
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-medium", STATUS_LABELS[node.status].color)}>
                  {STATUS_LABELS[node.status].text}
                </span>
                {node.cost > 0 && <span className="text-xs text-slate-500">{node.cost.toFixed(2)} credits</span>}
              </div>
              {node.error && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400">{node.error}</p>
                </div>
              )}
            </div>
            <GenericParamInspector node={node} />
          </>
        )}
      </div>
    </div>
  );
}
