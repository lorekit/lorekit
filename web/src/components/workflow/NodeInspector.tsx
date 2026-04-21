"use client";

import React, { useCallback, useMemo, useState } from "react";
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
  Sparkles,
  Loader2,
  Scissors,
  RotateCcw,
  Play,
  Download,
  Palette,
  Type,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflow-store";
import { clipUrl } from "@/lib/api";
import type { WorkflowNode, Scene, RenderOptions, RenderRecord, TextItem, Transition } from "@/lib/api";

/** Resolve a file path/URL to a full URL, adding /files/ prefix for local paths */
function resolveFileUrl(val: string): string {
  if (val.startsWith("http")) return val;
  const normalized = val.startsWith("/") ? val : `/${val}`;
  return clipUrl(normalized.startsWith("/files/") ? normalized : `/files${normalized}`);
}
import { Slider } from "@/components/ui/slider";
import { VoicePicker } from "@/components/ui/VoicePicker";
import type { ClipJobState } from "@/hooks/use-unified-editor";

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
// Keyframe Inspector — image generation + visual description (no video settings)
// ---------------------------------------------------------------------------

interface KeyframeInspectorProps {
  node: WorkflowNode;
  scene?: Scene | null;
  isGenerating?: boolean;
  onGenerateKeyframe?: (sceneId: string, sceneNum: number) => void;
}

function KeyframeInspector({
  node,
  scene,
  isGenerating,
  onGenerateKeyframe,
}: KeyframeInspectorProps) {
  const { workflow } = useWorkflowStore();
  const p = node.params;

  // Scene is the source of truth for creative direction.
  // Read from scene, fall back to node.params for backwards compat.
  const sceneVal = useCallback(
    (key: string) => (scene as any)?.[key] ?? p[key] ?? "",
    [scene, p]
  );

  // Debounced scene update via API
  const pendingUpdates = React.useRef<Record<string, any>>({});
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSceneUpdate = useCallback(() => {
    if (!scene || !workflow) return;
    const updates = { ...pendingUpdates.current };
    pendingUpdates.current = {};
    if (Object.keys(updates).length === 0) return;
    import("@/lib/api").then(({ updateScene }) =>
      updateScene(workflow.project_id, String(scene.scene_id), updates).catch(console.error)
    );
  }, [scene, workflow]);

  const updateSceneField = useCallback(
    (key: string, value: any) => {
      pendingUpdates.current[key] = value;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushSceneUpdate, 500);
    },
    [flushSceneUpdate]
  );

  // Flush on unmount
  React.useEffect(() => () => { flushSceneUpdate(); }, [flushSceneUpdate]);

  // Local state for textareas (responsive typing, debounced save)
  const [localVisualDesc, setLocalVisualDesc] = useState(sceneVal("visual_description"));
  const [localNarration, setLocalNarration] = useState(sceneVal("narration"));

  // Sync local state when scene changes externally
  React.useEffect(() => { setLocalVisualDesc(sceneVal("visual_description")); }, [scene?.scene_id]);
  React.useEffect(() => { setLocalNarration(sceneVal("narration")); }, [scene?.scene_id]);

  const sceneId = scene?.id ?? String(p.scene_id ?? "");
  const sceneNum = p.scene_id ?? (scene?.scene_id ?? 1);

  // Preview: keyframe node's own output image
  const nodeOutputUrl = node.outputs?.url
    ? resolveFileUrl(node.outputs.url as string)
    : null;
  const previewUrl = nodeOutputUrl
    ?? (scene?.keyframe_path ? clipUrl(`/files/${scene.keyframe_path}`) : null)
    ?? (scene?.keyframe_url ? clipUrl(scene.keyframe_url) : null);
  const hasKeyframe = !!(nodeOutputUrl || scene?.keyframe_url || scene?.keyframe_path);

  // Connected character ref images
  const connectedRefs = useMemo(() => {
    if (!workflow) return [];
    const refs: { key: string; label: string; url: string }[] = [];
    for (const key of ["ref_1", "ref_2", "ref_3", "ref_4"]) {
      const sourceRef = node.inputs[key];
      if (!sourceRef) continue;
      const sourceNodeId = sourceRef.split(".")[0];
      const sourceNode = workflow.nodes[sourceNodeId];
      if (!sourceNode) continue;
      const url = sourceNode.outputs?.url
        ? resolveFileUrl(sourceNode.outputs.url as string)
        : sourceNode.params.image_url
          ? resolveFileUrl(sourceNode.params.image_url as string)
          : null;
      if (url) refs.push({ key, label: sourceNode.label, url });
    }
    return refs;
  }, [workflow, node.inputs]);

  return (
    <div className="space-y-4">
      {/* Keyframe preview */}
      {previewUrl && (
        <div>
          <img
            src={previewUrl}
            alt={`Keyframe ${sceneNum}`}
            className="w-full rounded-lg border border-slate-700"
          />
          <div className="flex items-center gap-2 mt-2">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1"
            >
              Open
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(previewUrl)}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Copy URL
            </button>
          </div>
        </div>
      )}

      {/* Connected character references */}
      {connectedRefs.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">
            Character References ({connectedRefs.length}/4)
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {connectedRefs.map((ref) => (
              <div key={ref.key} className="relative rounded-lg overflow-hidden border border-slate-700">
                <img src={ref.url} alt={ref.label} className="w-full aspect-square object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                  <span className="text-[9px] text-white/80">{ref.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation Actions */}
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onGenerateKeyframe?.(sceneId, sceneNum)}
          disabled={!!isGenerating}
          className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed py-2 rounded-lg transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {hasKeyframe ? "Regenerate Keyframe" : "Generate Keyframe"}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Beat badge */}
      {sceneVal("beat") && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
            {sceneVal("beat")}
          </span>
          {p.scene_id && (
            <span className="text-xs text-slate-500">Scene {p.scene_id}</span>
          )}
        </div>
      )}

      {/* Visual Description */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Visual Description</label>
        <textarea
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 resize-none"
          rows={5}
          value={localVisualDesc}
          onChange={(e) => {
            setLocalVisualDesc(e.target.value);
            updateSceneField("visual_description", e.target.value);
          }}
          placeholder="What the AI should generate..."
        />
      </div>

      {/* Character toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-400">Character in Scene</label>
        <button
          onClick={() => {
            const newVal = !(sceneVal("character_present") ?? true);
            updateSceneField("character_present", newVal);
          }}
          className={cn(
            "w-9 h-5 rounded-full transition-colors relative",
            (sceneVal("character_present") ?? true) ? "bg-amber-500" : "bg-slate-700"
          )}
        >
          <div
            className={cn(
              "w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform",
              (sceneVal("character_present") ?? true) ? "translate-x-[18px]" : "translate-x-[3px]"
            )}
          />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clip Inspector — video generation settings (duration, speed, camera)
// ---------------------------------------------------------------------------

function ClipInspector({ node, scene }: { node: WorkflowNode; scene?: Scene | null }) {
  const { workflow, updateNodeParams } = useWorkflowStore();
  const p = node.params;
  const update = (key: string, value: any) => updateNodeParams(node.id, { [key]: value });
  const statusInfo = STATUS_LABELS[node.status];

  // Scene is source of truth for camera + narration
  const sceneCamera = (scene as any)?.camera ?? p.camera ?? "";
  const sceneNarration = (scene as any)?.narration ?? "";

  // Debounced scene update
  const pendingUpdates = React.useRef<Record<string, any>>({});
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSceneUpdate = useCallback(() => {
    if (!scene || !workflow) return;
    const updates = { ...pendingUpdates.current };
    pendingUpdates.current = {};
    if (Object.keys(updates).length === 0) return;
    import("@/lib/api").then(({ updateScene }) =>
      updateScene(workflow.project_id, String(scene.scene_id), updates).catch(console.error)
    );
  }, [scene, workflow]);
  const updateSceneField = useCallback(
    (key: string, value: any) => {
      pendingUpdates.current[key] = value;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushSceneUpdate, 500);
    },
    [flushSceneUpdate]
  );
  React.useEffect(() => () => { flushSceneUpdate(); }, [flushSceneUpdate]);

  const [localCamera, setLocalCamera] = useState(sceneCamera);
  const [localNarration, setLocalNarration] = useState(sceneNarration);
  React.useEffect(() => { setLocalCamera(sceneCamera); }, [scene?.scene_id]);
  React.useEffect(() => { setLocalNarration(sceneNarration); }, [scene?.scene_id]);

  const duration = p.duration ?? 5;
  const speed = p.speed ?? 1.0;
  const effectiveDuration = duration / speed;

  const outputUrl = Object.values(node.outputs).find(
    (v) => typeof v === "string" && (v.startsWith("http") || v.endsWith(".png") || v.endsWith(".jpg") || v.endsWith(".mp4"))
  ) as string | undefined;
  const isVideo = outputUrl?.endsWith(".mp4") || node.type.includes("kling") || node.type.includes("wan");

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
              src={resolveFileUrl(outputUrl)}
              controls
              className="w-full rounded-lg border border-slate-700"
            />
          ) : (
            <img
              src={resolveFileUrl(outputUrl)}
              alt="Output"
              className="w-full rounded-lg border border-slate-700"
            />
          )}
          <div className="flex items-center gap-2 mt-2">
            <a
              href={resolveFileUrl(outputUrl)}
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

      {/* Running state */}
      {node.status === "running" && !outputUrl && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="text-xs text-blue-400">Generating...</span>
        </div>
      )}

      <div className="border-t border-slate-800" />

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
          value={localCamera}
          onChange={(e) => {
            setLocalCamera(e.target.value);
            updateSceneField("camera", e.target.value);
          }}
          placeholder="Camera movement description..."
        />
      </div>

      {/* Narration */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Narration</label>
        <textarea
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 resize-none"
          rows={2}
          value={localNarration}
          onChange={(e) => {
            setLocalNarration(e.target.value);
            updateSceneField("narration", e.target.value);
          }}
          placeholder="What the character says (drives TTS audio)..."
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TTS Inspector — narration text, voice, audio preview
// ---------------------------------------------------------------------------

// Map node types to their fal.ai model endpoints for voice lookup
const TTS_NODE_TO_MODEL: Record<string, string> = {
  tts_minimax: "fal-ai/minimax/speech-2.6-turbo",
  tts_orpheus: "fal-ai/orpheus-tts",
  tts_elevenlabs: "fal-ai/elevenlabs/tts/multilingual-v2",
};

function TTSInspector({ node, scene, universeId }: { node: WorkflowNode; scene?: Scene | null; universeId?: string }) {
  const { workflow, updateNodeParams } = useWorkflowStore();
  const p = node.params;
  const statusInfo = STATUS_LABELS[node.status];

  // Narration from scene (source of truth)
  const sceneNarration = (scene as any)?.narration ?? "";

  // Debounced scene update
  const pendingUpdates = React.useRef<Record<string, any>>({});
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSceneUpdate = useCallback(() => {
    if (!scene || !workflow) return;
    const updates = { ...pendingUpdates.current };
    pendingUpdates.current = {};
    if (Object.keys(updates).length === 0) return;
    import("@/lib/api").then(({ updateScene }) =>
      updateScene(workflow.project_id, String(scene.scene_id), updates).catch(console.error)
    );
  }, [scene, workflow]);
  const updateSceneField = useCallback(
    (key: string, value: any) => {
      pendingUpdates.current[key] = value;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushSceneUpdate, 500);
    },
    [flushSceneUpdate]
  );
  React.useEffect(() => () => { flushSceneUpdate(); }, [flushSceneUpdate]);

  const [localNarration, setLocalNarration] = useState(sceneNarration);
  React.useEffect(() => { setLocalNarration(sceneNarration); }, [scene?.scene_id]);

  // Load available voices for this TTS model
  const [voices, setVoices] = useState<{ id: string; name: string; sample?: string }[]>([]);
  React.useEffect(() => {
    import("@/lib/api").then(({ getTTSModels }) =>
      getTTSModels().then((models) => {
        const modelKey = TTS_NODE_TO_MODEL[node.type];
        const model = modelKey ? models[modelKey] : null;
        setVoices(model?.voices ?? []);
      }).catch(console.error)
    );
  }, [node.type]);

  // Load project characters for the character selector
  const [characters, setCharacters] = useState<Array<{ id: string; name: string }>>([]);
  const [charVoiceName, setCharVoiceName] = useState<string | null>(null);
  React.useEffect(() => {
    if (!universeId) return;
    import("@/lib/api").then(({ getUniverseCharacters }) =>
      getUniverseCharacters(universeId).then((chars) =>
        setCharacters(chars.map((c) => ({ id: c.id, name: c.name })))
      ).catch(console.error)
    );
  }, [universeId]);

  // When character changes, load their voice config to show as hint
  const selectedCharId = p.character_id as string | undefined;
  React.useEffect(() => {
    if (!selectedCharId || !universeId) { setCharVoiceName(null); return; }
    import("@/lib/api").then(({ getCharacterVoice }) =>
      getCharacterVoice(universeId, selectedCharId).then((voice) => {
        const modelKey = TTS_NODE_TO_MODEL[node.type];
        if (voice && voice.tts_model === modelKey) {
          setCharVoiceName(voice.voice_name || null);
        } else {
          setCharVoiceName(null);
        }
      }).catch(() => setCharVoiceName(null))
    );
  }, [selectedCharId, universeId, node.type]);

  const outputUrl = node.outputs?.url as string | undefined;
  const autoPlaceholder = charVoiceName ? `Auto (${charVoiceName})` : "Auto (character voice)";

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

      {/* Audio Preview */}
      {outputUrl && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Output</label>
          <audio
            src={resolveFileUrl(outputUrl)}
            controls
            className="w-full"
          />
        </div>
      )}

      <div className="border-t border-slate-800" />

      {/* Character selector */}
      {characters.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Character</label>
          <select
            value={selectedCharId ?? ""}
            onChange={(e) => updateNodeParams(node.id, { character_id: e.target.value || undefined })}
            className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500"
          >
            <option value="">None (use project default)</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Narration */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Narration</label>
        <textarea
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 resize-none"
          rows={4}
          value={localNarration}
          onChange={(e) => {
            setLocalNarration(e.target.value);
            updateSceneField("narration", e.target.value);
          }}
          placeholder="What the character says..."
        />
      </div>

      {/* Voice Selection */}
      <VoicePicker
        voices={voices}
        selectedId={p.voice_id as string | undefined}
        onSelect={(id) => updateNodeParams(node.id, { voice_id: id || undefined })}
        placeholder={autoPlaceholder}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generation Inspector — status, preview, retry
// ---------------------------------------------------------------------------

function GenerationInspector({ node }: { node: WorkflowNode }) {
  const statusInfo = STATUS_LABELS[node.status];

  const outputUrl = Object.values(node.outputs).find(
    (v) => typeof v === "string" && (v.startsWith("http") || v.endsWith(".png") || v.endsWith(".jpg") || v.endsWith(".mp4"))
  ) as string | undefined;

  const isVideo = outputUrl?.endsWith(".mp4") || node.type.includes("kling") || node.type.includes("wan");

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
              src={resolveFileUrl(outputUrl)}
              controls
              className="w-full rounded-lg border border-slate-700"
            />
          ) : (
            <img
              src={resolveFileUrl(outputUrl)}
              alt="Output"
              className="w-full rounded-lg border border-slate-700"
            />
          )}
          <div className="flex items-center gap-2 mt-2">
            <a
              href={resolveFileUrl(outputUrl)}
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

      {/* Running state */}
      {node.status === "running" && !outputUrl && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="text-xs text-blue-400">Generating...</span>
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
// Character Ref Inspector — image preview + delete
// ---------------------------------------------------------------------------

function CharacterRefInspector({ node, canDelete, onDelete }: { node: WorkflowNode; canDelete: boolean; onDelete: () => void }) {
  const imageUrl = node.outputs?.url
    ? resolveFileUrl(node.outputs.url as string)
    : node.params.image_url
      ? resolveFileUrl(node.params.image_url as string)
      : null;

  const statusInfo = STATUS_LABELS[node.status];

  return (
    <div className="space-y-4">
      {/* Status */}
      <div>
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Status</h3>
        <span className={cn("text-sm font-medium", statusInfo.color)}>
          {statusInfo.text}
        </span>
      </div>

      {/* Image preview */}
      {imageUrl && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">image_url</label>
          <img
            src={imageUrl}
            alt={node.label}
            className="w-full rounded-lg border border-slate-700"
          />
          <p className="text-[10px] text-slate-500 mt-1.5 break-all">
            {(node.params.image_url as string) || (node.outputs?.url as string) || ""}
          </p>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={cn(
          "flex items-center justify-center gap-1.5 w-full text-xs py-2 rounded-lg transition-colors",
          canDelete
            ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
            : "text-slate-600 bg-slate-800 cursor-not-allowed"
        )}
      >
        <Trash2 className="w-3.5 h-3.5" />
        {canDelete ? "Remove from Canvas" : "Connected to completed generation"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kontext Edit Inspector — single image edit
// ---------------------------------------------------------------------------

function KontextEditInspector({ node }: { node: WorkflowNode }) {
  const { workflow, updateNodeParams } = useWorkflowStore();
  const p = node.params;
  const update = (key: string, value: any) => updateNodeParams(node.id, { [key]: value });
  const statusInfo = STATUS_LABELS[node.status];

  // Output preview
  const outputUrl = node.outputs?.url
    ? resolveFileUrl(node.outputs.url as string)
    : null;

  // Input image (from connected node)
  const inputImageUrl = useMemo(() => {
    if (!workflow) return null;
    const sourceRef = node.inputs.image;
    if (!sourceRef) return null;
    const sourceNodeId = sourceRef.split(".")[0];
    const sourceNode = workflow.nodes[sourceNodeId];
    if (!sourceNode) return null;
    const url = sourceNode.outputs?.url ?? sourceNode.params.image_url;
    return typeof url === "string" ? resolveFileUrl(url) : null;
  }, [workflow, node.inputs]);

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

      {/* Output preview (if completed) */}
      {outputUrl && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Output</label>
          <img src={outputUrl} alt="Edited" className="w-full rounded-lg border border-slate-700" />
          <div className="flex items-center gap-2 mt-2">
            <a
              href={outputUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open
            </a>
          </div>
        </div>
      )}

      {/* Input image preview */}
      {inputImageUrl && !outputUrl && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Input Image</label>
          <img src={inputImageUrl} alt="Input" className="w-full rounded-lg border border-slate-700 opacity-70" />
        </div>
      )}

      {!inputImageUrl && !outputUrl && (
        <div className="w-full h-24 rounded-lg border border-dashed border-slate-700/50 bg-slate-800/30 flex items-center justify-center">
          <span className="text-[10px] text-slate-600">Connect an image to edit</span>
        </div>
      )}

      {/* Running state */}
      {node.status === "running" && !outputUrl && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="text-xs text-blue-400">Editing...</span>
        </div>
      )}

      <div className="border-t border-slate-800" />

      {/* Edit Prompt */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Edit Prompt</label>
        <textarea
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 resize-none"
          rows={4}
          value={p.prompt ?? ""}
          onChange={(e) => update("prompt", e.target.value)}
          placeholder="Describe the edit (e.g., 'Change outfit to a red dress')"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transition Inspector
// ---------------------------------------------------------------------------

function TransitionInspector({ node }: { node: WorkflowNode }) {
  const { workflow, updateNodeParams } = useWorkflowStore();
  const p = node.params;
  const update = (key: string, value: any) => updateNodeParams(node.id, { [key]: value });
  const statusInfo = STATUS_LABELS[node.status];

  // Resolve connected start/end image thumbnails
  const connectedImages = useMemo(() => {
    if (!workflow) return { start: null, end: null };
    const resolve = (key: string) => {
      const ref = node.inputs[key];
      if (!ref) return null;
      const srcId = ref.split(".")[0];
      const src = workflow.nodes[srcId];
      if (!src) return null;
      const url = src.outputs?.url ?? src.params?.image_url;
      return typeof url === "string" ? resolveFileUrl(url) : null;
    };
    return { start: resolve("start_image"), end: resolve("end_image") };
  }, [workflow, node.inputs]);

  // Output video preview
  const outputUrl = node.outputs?.url
    ? resolveFileUrl(node.outputs.url as string)
    : null;

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

      {/* Output video */}
      {outputUrl && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Output</label>
          <video src={outputUrl} controls className="w-full rounded-lg border border-slate-700" />
        </div>
      )}

      {/* Running */}
      {node.status === "running" && !outputUrl && (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          <span className="text-xs text-blue-400">Generating transition...</span>
        </div>
      )}

      {/* Start/End keyframe previews (optional) */}
      {(connectedImages.start || connectedImages.end) && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Keyframe Overrides</label>
          <div className="grid grid-cols-2 gap-1.5">
            {connectedImages.start ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-700">
                <img src={connectedImages.start} alt="Start" className="w-full aspect-video object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                  <span className="text-[9px] text-white/80">Start</span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700 aspect-video flex items-center justify-center">
                <span className="text-[9px] text-slate-600">Auto</span>
              </div>
            )}
            {connectedImages.end ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-700">
                <img src={connectedImages.end} alt="End" className="w-full aspect-video object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                  <span className="text-[9px] text-white/80">End</span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-700 aspect-video flex items-center justify-center">
                <span className="text-[9px] text-slate-600">Auto</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-600 mt-1">Connect keyframes to override auto-extracted frames</p>
        </div>
      )}

      <div className="border-t border-slate-800" />

      {/* Prompt */}
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

      {/* Duration */}
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

      {/* Speed */}
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
// Timeline Transition Inspector — used when selecting transitions on timeline
// ---------------------------------------------------------------------------

function TimelineTransitionInspector({
  transition,
  onUpdate,
}: {
  transition: Transition;
  onUpdate: (updates: Partial<Transition>) => void;
}) {
  const outputUrl = transition.clip_url
    ? resolveFileUrl(transition.clip_url)
    : transition.clip_path
      ? resolveFileUrl(transition.clip_path)
      : null;

  const handleImageUpload = useCallback(
    (field: "start_image_url" | "end_image_url") => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        // Upload to backend and get URL
        const formData = new FormData();
        formData.append("file", file);
        try {
          const resp = await fetch(clipUrl("/api/upload"), { method: "POST", body: formData });
          const data = await resp.json();
          if (data.url || data.path) {
            onUpdate({ [field]: data.url || data.path });
          }
        } catch (err) {
          console.error("Upload failed:", err);
        }
      };
      input.click();
    },
    [onUpdate]
  );

  return (
    <div className="space-y-4">
      {/* Status */}
      <div>
        <span className={cn("text-sm font-medium", outputUrl ? "text-emerald-400" : "text-slate-400")}>
          {outputUrl ? "Completed" : "Pending"}
        </span>
      </div>

      {/* Output video */}
      {outputUrl && (
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">Output</label>
          <video src={outputUrl} controls className="w-full rounded-lg border border-slate-700" />
        </div>
      )}

      <div className="border-t border-slate-800" />

      {/* Start/End Frame Overrides */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">
          Frame Overrides <span className="text-slate-600 font-normal">(optional)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {/* Start frame */}
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Start Frame</p>
            {transition.start_image_url ? (
              <div className="relative group rounded-lg overflow-hidden border border-slate-700">
                <img
                  src={resolveFileUrl(transition.start_image_url)}
                  alt="Start"
                  className="w-full aspect-video object-cover"
                />
                <button
                  onClick={() => onUpdate({ start_image_url: null })}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleImageUpload("start_image_url")}
                className="w-full aspect-video rounded-lg border border-dashed border-slate-700 bg-slate-800/30 flex flex-col items-center justify-center gap-1 hover:border-amber-500/50 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-slate-600" />
                <span className="text-[9px] text-slate-600">Auto from clip</span>
              </button>
            )}
          </div>

          {/* End frame */}
          <div>
            <p className="text-[10px] text-slate-500 mb-1">End Frame</p>
            {transition.end_image_url ? (
              <div className="relative group rounded-lg overflow-hidden border border-slate-700">
                <img
                  src={resolveFileUrl(transition.end_image_url)}
                  alt="End"
                  className="w-full aspect-video object-cover"
                />
                <button
                  onClick={() => onUpdate({ end_image_url: null })}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleImageUpload("end_image_url")}
                className="w-full aspect-video rounded-lg border border-dashed border-slate-700 bg-slate-800/30 flex flex-col items-center justify-center gap-1 hover:border-amber-500/50 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-slate-600" />
                <span className="text-[9px] text-slate-600">Auto from clip</span>
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5">Upload images to override auto-extracted frames</p>
      </div>

      <div className="border-t border-slate-800" />

      {/* Prompt */}
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Transition Prompt</label>
        <textarea
          className="w-full bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 outline-none focus:border-amber-500 resize-none"
          rows={3}
          value={transition.prompt ?? ""}
          onChange={(e) => onUpdate({ prompt: e.target.value })}
          placeholder="How the camera/visual morphs between scenes..."
        />
      </div>

      {/* Duration */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">Duration</label>
          <span className="text-xs font-bold text-amber-400">{transition.duration ?? 3}s</span>
        </div>
        <Slider
          value={transition.duration ?? 3}
          min={3}
          max={15}
          step={1}
          onChange={(v) => onUpdate({ duration: v })}
        />
      </div>

      {/* Speed */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">Speed</label>
          <span className="text-xs font-bold text-amber-400">{(transition.speed ?? 1.0).toFixed(2)}x</span>
        </div>
        <Slider
          value={transition.speed ?? 1.0}
          min={0.25}
          max={4}
          step={0.05}
          onChange={(v) => onUpdate({ speed: Math.round(v * 100) / 100 })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full Video Inspector — Output/Color/Text/Audio tabs
// ---------------------------------------------------------------------------

interface FullVideoInspectorProps {
  renderOpts: RenderOptions;
  setRenderOpts: (fn: (prev: RenderOptions) => RenderOptions) => void;
  colorGrade: { temperature: number; saturation: number; contrast: number; vignette: number };
  onColorGradeChange: (key: string, value: number) => void;
  onRender: () => void;
  onDownload: () => void;
  isRendering: boolean;
  isPublishing: boolean;
  hasOutput: boolean;
  isRendered: boolean;
  renders: RenderRecord[];
  onDownloadRender: (path: string) => void;
  onDeleteRender: (jobId: string) => void;
  audioVolume?: number;
  onAudioVolumeChange?: (v: number) => void;
}

function FullVideoInspector({
  renderOpts,
  setRenderOpts,
  colorGrade,
  onColorGradeChange,
  onRender,
  onDownload,
  isRendering,
  isPublishing,
  hasOutput,
  isRendered,
  renders,
  onDownloadRender,
  onDeleteRender,
}: FullVideoInspectorProps) {
  const [tab, setTab] = useState<"output" | "color">("output");

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        {(["output", "color"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 text-xs py-2 font-medium capitalize transition-colors",
              tab === t ? "text-amber-400 border-b-2 border-amber-500" : "text-slate-500 hover:text-slate-300"
            )}
          >
            {t === "output" ? (
              <span className="flex items-center justify-center gap-1"><Play className="w-3 h-3" /> Output</span>
            ) : (
              <span className="flex items-center justify-center gap-1"><Palette className="w-3 h-3" /> Color</span>
            )}
          </button>
        ))}
      </div>

      {tab === "output" && (
        <div className="space-y-3">
          {/* Render options */}
          <div className="space-y-2">
            {(["text_overlays", "color_grade", "audio"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={renderOpts[opt] ?? true}
                  onChange={(e) =>
                    setRenderOpts((o) => ({ ...o, [opt]: e.target.checked }))
                  }
                  className="rounded"
                />
                {opt === "text_overlays" ? "Text Overlays" : opt === "color_grade" ? "Color Grading" : "Audio"}
              </label>
            ))}
          </div>

          {/* Render / Download buttons */}
          <button
            onClick={onRender}
            disabled={isRendering}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {isRendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clapperboard className="w-3.5 h-3.5" />}
            {isRendering ? "Rendering..." : "Render"}
          </button>

          {hasOutput && (
            <button
              onClick={onDownload}
              disabled={isPublishing || !isRendered}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg disabled:opacity-40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          )}

          {/* Render history */}
          {renders.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-2">Render History</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {renders.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-slate-800/50 rounded px-2 py-1.5">
                    <span className="text-[10px] text-slate-400 truncate flex-1">
                      {r.timestamp ? new Date(r.timestamp).toLocaleString() : r.id.slice(0, 8)}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.output_path && (
                        <button
                          onClick={() => onDownloadRender(r.output_path!)}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteRender(r.id)}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "color" && (
        <div className="space-y-4">
          {([
            { key: "temperature", label: "Temperature", min: 3000, max: 9000, step: 100, unit: "K" },
            { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.05, unit: "" },
            { key: "contrast", label: "Contrast", min: 0, max: 2, step: 0.05, unit: "" },
            { key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.05, unit: "" },
          ] as const).map(({ key, label, min, max, step, unit }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">{label}</label>
                <span className="text-xs font-bold text-amber-400">
                  {colorGrade[key as keyof typeof colorGrade]}{unit}
                </span>
              </div>
              <Slider
                value={colorGrade[key as keyof typeof colorGrade]}
                min={min}
                max={max}
                step={step}
                onChange={(v) => onColorGradeChange(key, v)}
              />
            </div>
          ))}
        </div>
      )}
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

export interface NodeInspectorProps {
  // Scene integration
  scenes?: Scene[];
  clipJobs?: Record<string, ClipJobState>;
  isGenerating?: boolean;
  onGenerateKeyframe?: (sceneId: string, sceneNum: number) => void;
  onRegenerateClip?: (sceneId: string) => void;
  onExtractFrame?: () => void;
  extractingFrame?: boolean;
  characterImageUrl?: string | null;
  pickerImages?: Array<{ url: string; path: string | null; label: string }>;

  // Timeline selection
  selectedElement?: { type: string; [key: string]: any } | null;
  selectedTransition?: Transition | null;
  onUpdateTransition?: (fromId: number, toId: number, updates: Partial<Transition>) => void;
  renderOpts?: RenderOptions;
  setRenderOpts?: (fn: (prev: RenderOptions) => RenderOptions) => void;
  colorGrade?: { temperature: number; saturation: number; contrast: number; vignette: number };
  onColorGradeChange?: (key: string, value: number) => void;
  onRender?: () => void;
  onDownload?: () => void;
  isRendering?: boolean;
  isPublishing?: boolean;
  project?: { output_path: string | null; status: string } | null;
  renders?: RenderRecord[];
  onDownloadRender?: (path: string) => void;
  onDeleteRender?: (jobId: string) => void;
  universeId?: string;
}

export function NodeInspector({
  scenes,
  clipJobs,
  isGenerating,
  onGenerateKeyframe,
  onRegenerateClip,
  onExtractFrame,
  extractingFrame,
  characterImageUrl,
  pickerImages,
  selectedElement,
  selectedTransition,
  onUpdateTransition,
  renderOpts,
  setRenderOpts,
  colorGrade,
  onColorGradeChange,
  onRender,
  onDownload,
  isRendering,
  isPublishing,
  project,
  renders,
  onDownloadRender,
  onDeleteRender,
  universeId,
}: NodeInspectorProps) {
  const { workflow, selectedNodeId, updateNodeLabel, removeNode } = useWorkflowStore();
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  const node = selectedNodeId && workflow ? workflow.nodes[selectedNodeId] : null;

  const handleLabelSave = useCallback(() => {
    if (node && labelDraft.trim()) {
      updateNodeLabel(node.id, labelDraft.trim());
    }
    setEditingLabel(false);
  }, [node, labelDraft, updateNodeLabel]);

  // For character_ref: can delete only if no downstream node has completed generation
  const canDeleteCharRef = useMemo(() => {
    if (!node || node.type !== "character_ref" || !workflow) return false;
    for (const other of Object.values(workflow.nodes)) {
      if (other.id === node.id) continue;
      const refsThisNode = Object.values(other.inputs).some((ref) => ref.startsWith(node.id));
      if (refsThisNode && other.status === "completed") return false;
    }
    return true;
  }, [node, workflow]);

  const handleDeleteCharRef = useCallback(async () => {
    if (!node || !canDeleteCharRef) return;
    removeNode(node.id);
    const wf = useWorkflowStore.getState().workflow;
    if (wf) {
      const { updateWorkflowFull } = await import("@/lib/api");
      await updateWorkflowFull(wf.project_id, wf);
    }
  }, [node, canDeleteCharRef, removeNode]);

  // Show Full Video inspector when full-video is selected
  if (selectedElement?.type === "full-video" && renderOpts && setRenderOpts && colorGrade && onColorGradeChange && onRender && onDownload) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-200">Full Video</span>
          </div>
        </div>
        <div className="px-4 py-3">
          <FullVideoInspector
            renderOpts={renderOpts}
            setRenderOpts={setRenderOpts}
            colorGrade={colorGrade}
            onColorGradeChange={onColorGradeChange}
            onRender={onRender}
            onDownload={onDownload}
            isRendering={isRendering ?? false}
            isPublishing={isPublishing ?? false}
            hasOutput={!!project?.output_path}
            isRendered={project?.status === "rendered"}
            renders={renders ?? []}
            onDownloadRender={onDownloadRender ?? (() => {})}
            onDeleteRender={onDeleteRender ?? (() => {})}
          />
        </div>
      </div>
    );
  }

  // Show Transition inspector when a timeline transition is selected
  if (selectedElement?.type === "transition" && selectedTransition) {
    const t = selectedTransition;
    // Build a virtual WorkflowNode so TransitionInspector can render
    const virtualNode: WorkflowNode = {
      id: `transition_${t.from_scene_id}_${t.to_scene_id}`,
      type: "transition",
      label: `Transition ${t.from_scene_id} → ${t.to_scene_id}`,
      params: {
        prompt: t.prompt ?? "",
        duration: t.duration ?? 3,
        speed: t.speed ?? 1.0,
      },
      inputs: {},
      outputs: t.clip_url ? { url: t.clip_url } : t.clip_path ? { url: t.clip_path } : {},
      status: t.clip_url || t.clip_path ? "completed" : "pending",
      error: null,
      cost: 0,
      position: { x: 0, y: 0 },
    };
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <Shuffle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-slate-200">
              Transition {t.from_scene_id} → {t.to_scene_id}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono">transition</p>
        </div>
        <div className="px-4 py-3">
          <TimelineTransitionInspector
            transition={t}
            onUpdate={(updates) =>
              onUpdateTransition?.(t.from_scene_id, t.to_scene_id, updates)
            }
          />
        </div>
      </div>
    );
  }

  // No node selected
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
  const isCharacterRef = node.type === "character_ref";
  const isKontextEdit = node.type === "kontext_edit";
  // A node is "keyframe-like" if it has scene_id in params (keyframe nodes from from_story template)
  const isKeyframe = !isCharacterRef && !isKontextEdit && (node.type === "scene" || (node.params.scene_id != null && (node.type.includes("keyframe") || node.type === "flux_text_to_image" || node.type === "nano_banana")));
  const isTransition = node.type === "transition";
  // Clip/video generation nodes (kling, wan, etc.) — NOT TTS
  const isTTS = node.type.startsWith("tts_");
  const isLipSync = node.type === "lipsync";
  const isClip = !isKeyframe && !isCharacterRef && !isKontextEdit && !isTTS && !isLipSync && (node.type.includes("kling") || node.type.includes("wan"));
  const isGeneration = !isKeyframe && !isCharacterRef && !isClip && !isKontextEdit && !isTTS && node.type.includes("nano_banana");

  // Find matching scene for keyframe, clip, and TTS nodes
  const matchingScene = (isKeyframe || isClip || isTTS) && scenes && node.params.scene_id != null
    ? scenes.find((s) => String(s.scene_id) === String(node.params.scene_id))
    : null;

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
        {isCharacterRef ? (
          <CharacterRefInspector
            node={node}
            canDelete={canDeleteCharRef}
            onDelete={handleDeleteCharRef}
          />
        ) : isKontextEdit ? (
          <KontextEditInspector node={node} />
        ) : isKeyframe ? (
          <KeyframeInspector
            node={node}
            scene={matchingScene}
            isGenerating={isGenerating}
            onGenerateKeyframe={onGenerateKeyframe}
          />
        ) : isClip ? (
          <ClipInspector node={node} scene={matchingScene} />
        ) : isTTS ? (
          <TTSInspector node={node} scene={matchingScene} universeId={universeId} />
        ) : isLipSync ? (
          <GenerationInspector node={node} />
        ) : isTransition ? (
          <TransitionInspector node={node} />
        ) : isGeneration ? (
          <GenerationInspector node={node} />
        ) : (
          <>
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
