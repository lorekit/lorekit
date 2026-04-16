"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Workflow as WorkflowIcon,
  Sparkles,
  Music,
  Image as ImageIcon,
  Clapperboard,
  Type,
  GitBranch,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflow-store";
import {
  getWorkflow,
  createWorkflow,
  updateWorkflowFull,
  getWorkflowTemplates,
  getProject,
  getScenes,
  getProjectRenders,
  addTextItem,
  deleteTextItem,
  updateScene,
  updateTransition,
  deleteProjectRender,
  clipUrl,
} from "@/lib/api";
import type {
  Workflow,
  Project,
  Scene,
  Transition,
  TextItem,
  RenderRecord,
} from "@/lib/api";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { NodeInspector } from "@/components/workflow/NodeInspector";
import { WorkflowToolbar } from "@/components/workflow/WorkflowToolbar";
import { NodePalette } from "@/components/workflow/NodePalette";
import { EditorTimeline } from "@/components/editor/EditorTimeline";

// ---------------------------------------------------------------------------
// Left panel tab types for the workflow page
// ---------------------------------------------------------------------------

type WorkflowLeftTab = "nodes" | "audio" | "media" | "renders" | "text";

const LEFT_TABS: Array<{
  key: WorkflowLeftTab;
  label: string;
  icon: React.ElementType;
}> = [
  { key: "nodes", label: "Nodes", icon: GitBranch },
  { key: "audio", label: "Audio", icon: Music },
  { key: "media", label: "Media", icon: ImageIcon },
  { key: "renders", label: "Renders", icon: Clapperboard },
  { key: "text", label: "Text", icon: Type },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkflowPage({
  params,
}: {
  params: Promise<{ universeId: string; id: string }>;
}) {
  const { universeId, id: projectId } = use(params);
  const { workflow, setWorkflow } = useWorkflowStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; description: string }>
  >([]);
  const [showCreate, setShowCreate] = useState(false);

  // Project data for timeline and left panel tabs
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [renders, setRenders] = useState<RenderRecord[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [activeLeftTab, setActiveLeftTab] = useState<WorkflowLeftTab>("nodes");

  // Load workflow + project data in parallel
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Load workflow and project data in parallel
        const [wfResult, projResult, scenesResult, rendersResult] =
          await Promise.allSettled([
            getWorkflow(projectId),
            getProject(projectId),
            getScenes(projectId),
            getProjectRenders(projectId),
          ]);

        if (cancelled) return;

        // Handle workflow result
        if (wfResult.status === "fulfilled") {
          setWorkflow(wfResult.value);
        } else {
          const err = wfResult.reason;
          if (err?.message?.includes("404")) {
            setWorkflow(null);
            setShowCreate(true);
            try {
              const data = await getWorkflowTemplates();
              if (!cancelled) setTemplates(data.templates);
            } catch {}
          } else {
            setError(err?.message || "Failed to load workflow");
          }
        }

        // Handle project data (non-blocking — timeline is optional)
        if (projResult.status === "fulfilled") {
          setProject(projResult.value);
        }
        if (scenesResult.status === "fulfilled") {
          setScenes(scenesResult.value.scenes);
          setTransitions(scenesResult.value.transitions);
          setTextItems(scenesResult.value.text_items);
          if (
            scenesResult.value.scenes.length > 0 &&
            !selectedSceneId
          ) {
            setSelectedSceneId(scenesResult.value.scenes[0].id);
          }
        }
        if (rendersResult.status === "fulfilled") {
          setRenders(rendersResult.value.renders ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, setWorkflow]);

  // Clean up on unmount
  useEffect(() => {
    return () => setWorkflow(null);
  }, [setWorkflow]);

  // Auto-save positions on unmount
  useEffect(() => {
    return () => {
      const wf = useWorkflowStore.getState().workflow;
      if (wf && wf.status === "draft") {
        updateWorkflowFull(projectId, wf).catch(() => {});
      }
    };
  }, [projectId]);

  const handleCreate = useCallback(
    async (template?: string) => {
      setCreating(true);
      try {
        const wf = await createWorkflow({
          project_id: projectId,
          template,
          name: template ? undefined : "New Workflow",
        });
        setWorkflow(wf);
        setShowCreate(false);
      } catch (err: any) {
        setError(err?.message || "Failed to create workflow");
      } finally {
        setCreating(false);
      }
    },
    [projectId, setWorkflow]
  );

  const handleSelectTemplate = useCallback(
    async (templateId: string) => {
      setCreating(true);
      try {
        const wf = await createWorkflow({
          project_id: projectId,
          template: templateId,
        });
        setWorkflow(wf);
        setShowCreate(false);
      } catch (err: any) {
        setError(err?.message || "Failed to create workflow from template");
      } finally {
        setCreating(false);
      }
    },
    [projectId, setWorkflow]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-950 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-sm text-slate-400">Loading workflow...</p>
      </div>
    );
  }

  // Error state
  if (error && !showCreate) {
    return (
      <div className="flex flex-col h-screen bg-slate-950 items-center justify-center px-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-md text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <Link
            href={`/app/universe/${universeId}/projects/${projectId}`}
            className="text-xs text-amber-500 hover:text-amber-400"
          >
            Back to editor
          </Link>
        </div>
      </div>
    );
  }

  // Create workflow screen
  if (!workflow || showCreate) {
    return (
      <div className="flex flex-col h-screen bg-slate-950 items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <WorkflowIcon className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold text-slate-200 mb-2">
              Create Workflow
            </h1>
            <p className="text-sm text-slate-500">
              Build a node-based pipeline for generating video assets with
              fal.ai
            </p>
          </div>

          {/* Empty workflow */}
          <button
            onClick={() => handleCreate()}
            disabled={creating}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all mb-3 group"
          >
            <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-amber-500/10">
              <Plus className="w-5 h-5 text-slate-400 group-hover:text-amber-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-300 group-hover:text-slate-100">
                Blank Workflow
              </p>
              <p className="text-xs text-slate-500">
                Start from scratch with an empty canvas
              </p>
            </div>
          </button>

          {/* Templates */}
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => handleCreate(tmpl.id)}
              disabled={creating}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-900/80 transition-all mb-3 group"
            >
              <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-amber-500/10">
                <Sparkles className="w-5 h-5 text-slate-400 group-hover:text-amber-500" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-slate-300 group-hover:text-slate-100">
                  {tmpl.name}
                </p>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {tmpl.description}
                </p>
              </div>
            </button>
          ))}

          {creating && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            </div>
          )}

          <div className="text-center mt-6">
            <Link
              href={`/app/universe/${universeId}/projects/${projectId}`}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Back to project editor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Handlers for timeline and left panel tab content
  const handleAddText = useCallback(async () => {
    try {
      const item = await addTextItem(projectId);
      setTextItems((prev) => [...prev, item]);
      setSelectedTextId(item.id);
    } catch {}
  }, [projectId]);

  const handleDeleteText = useCallback(
    async (textId: string) => {
      try {
        await deleteTextItem(projectId, textId);
        setTextItems((prev) => prev.filter((t) => t.id !== textId));
        if (selectedTextId === textId) setSelectedTextId(null);
      } catch {}
    },
    [projectId, selectedTextId]
  );

  const handleUpdateScene = useCallback(
    async (sceneId: string, updates: Partial<Scene>) => {
      try {
        await updateScene(projectId, sceneId, updates);
        setScenes((prev) =>
          prev.map((s) => (s.id === sceneId ? { ...s, ...updates } : s))
        );
      } catch {}
    },
    [projectId]
  );

  const handleUpdateTransition = useCallback(
    async (fromId: number, toId: number, updates: Partial<Transition>) => {
      try {
        await updateTransition(projectId, fromId, toId, updates);
        setTransitions((prev) =>
          prev.map((t) =>
            t.from_scene_id === fromId && t.to_scene_id === toId
              ? { ...t, ...updates }
              : t
          )
        );
      } catch {}
    },
    [projectId]
  );

  const handleDownloadRender = useCallback((path: string) => {
    window.open(clipUrl(`/files/${path}`), "_blank");
  }, []);

  const handleDeleteRender = useCallback(
    async (jobId: string) => {
      try {
        await deleteProjectRender(projectId, jobId);
        setRenders((prev) => prev.filter((r) => r.id !== jobId));
      } catch {}
    },
    [projectId]
  );

  // Main editor
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      {/* Toolbar */}
      <WorkflowToolbar universeId={universeId} projectId={projectId} />

      {/* 3-panel layout (takes remaining space above timeline) */}
      <div className="flex-1 min-h-0 flex gap-px">
        {/* Left panel: Tabbed (Nodes + Audio/Media/Renders/Text) */}
        <div className="w-64 shrink-0 bg-slate-900/80 border-r border-slate-800 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-800/50 flex-shrink-0 overflow-x-auto">
            {LEFT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveLeftTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors whitespace-nowrap border-b-2",
                  activeLeftTab === tab.key
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
            {activeLeftTab === "nodes" && (
              <NodePalette onSelectTemplate={handleSelectTemplate} />
            )}

            {activeLeftTab === "audio" && (
              <AudioTabContent
                audioFilename={project?.uploaded_audio_path}
              />
            )}

            {activeLeftTab === "media" && (
              <MediaTabContent
                scenes={scenes}
                characterPortraitUrl={project?.character_image_url ?? project?.character_image_path}
              />
            )}

            {activeLeftTab === "renders" && (
              <RendersTabContent
                renders={renders}
                onDownload={handleDownloadRender}
                onDelete={handleDeleteRender}
              />
            )}

            {activeLeftTab === "text" && (
              <TextTabContent
                textItems={textItems}
                selectedTextId={selectedTextId}
                onSelectText={setSelectedTextId}
                onAddText={handleAddText}
                onDeleteText={handleDeleteText}
              />
            )}
          </div>
        </div>

        {/* Center: React Flow Canvas */}
        <div className="flex-1 min-w-0">
          <WorkflowCanvas />
        </div>

        {/* Right panel: Node Inspector */}
        <div className="w-72 shrink-0 bg-slate-900/80 border-l border-slate-800 overflow-hidden">
          <NodeInspector />
        </div>
      </div>

      {/* Bottom: Editor Timeline */}
      {scenes.length > 0 && (
        <EditorTimeline
          scenes={scenes}
          transitions={transitions}
          selectedSceneId={selectedSceneId}
          onSelectScene={setSelectedSceneId}
          audioMode={project?.audio_mode}
          audioFilename={project?.uploaded_audio_path}
          onUpdateScene={handleUpdateScene}
          onUpdateTransition={handleUpdateTransition}
          textItems={textItems}
          selectedTextId={selectedTextId}
          onSelectText={setSelectedTextId}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline tab content components (lightweight wrappers matching old LeftPanel)
// ---------------------------------------------------------------------------

function AudioTabContent({ audioFilename }: { audioFilename?: string }) {
  return (
    <div className="p-3 space-y-4">
      {audioFilename ? (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-amber-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 truncate">
                {audioFilename.split("/").pop()}
              </p>
              <p className="text-[10px] text-slate-500">Uploaded audio</p>
            </div>
          </div>
          <audio
            controls
            src={clipUrl(`/files/${audioFilename}`)}
            className="w-full h-8"
            style={{ colorScheme: "dark" }}
          />
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center">
          <Music className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No audio uploaded</p>
          <p className="text-[10px] text-slate-600 mt-1">
            Upload audio from the project editor
          </p>
        </div>
      )}
    </div>
  );
}

function MediaTabContent({
  scenes,
  characterPortraitUrl,
}: {
  scenes: Scene[];
  characterPortraitUrl?: string | null;
}) {
  const seen = new Set<string>();
  const allKeyframes: Array<{
    url: string;
    label: string;
    active: boolean;
  }> = [];

  for (const s of scenes) {
    const displayUrl = s.keyframe_path
      ? `/files/${s.keyframe_path}`
      : s.keyframe_url;
    if (displayUrl && !seen.has(displayUrl)) {
      seen.add(displayUrl);
      allKeyframes.push({
        url: displayUrl,
        label: `Scene ${s.scene_id ?? "?"}`,
        active: true,
      });
    }
  }

  const hasAny = !!(characterPortraitUrl || allKeyframes.length);

  return (
    <div className="p-3 space-y-4 overflow-y-auto">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        Media Gallery
      </p>

      {!hasAny && (
        <div className="py-8 text-center">
          <ImageIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No images available yet.</p>
        </div>
      )}

      {characterPortraitUrl && (
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">
            Character Portrait
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="relative rounded-lg overflow-hidden border border-slate-800">
              <img
                src={
                  characterPortraitUrl.startsWith("http")
                    ? characterPortraitUrl
                    : clipUrl(characterPortraitUrl)
                }
                alt="Portrait"
                className="w-full aspect-[9/16] object-cover"
              />
            </div>
          </div>
        </div>
      )}

      {allKeyframes.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1.5">
            Scene Keyframes
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {allKeyframes.map(({ url, label }, idx) => (
              <div
                key={`kf-${idx}`}
                className="relative rounded-lg overflow-hidden border border-slate-800"
              >
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
    </div>
  );
}

function RendersTabContent({
  renders,
  onDownload,
  onDelete,
}: {
  renders: RenderRecord[];
  onDownload?: (path: string) => void;
  onDelete?: (jobId: string) => void;
}) {
  if (!renders || renders.length === 0) {
    return (
      <div className="p-4 text-center">
        <Clapperboard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No renders yet</p>
        <p className="text-xs text-slate-600 mt-1">
          Render your video to see it here
        </p>
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
            {displayPath && (
              <div
                className="relative bg-black rounded overflow-hidden"
                style={{ aspectRatio: "16/9" }}
              >
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
                  {date
                    ? date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Render"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {displayPath && onDownload && (
                  <button
                    type="button"
                    onClick={() => onDownload(displayPath)}
                    className="text-[10px] text-amber-400 hover:text-amber-300"
                  >
                    Download
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(render.id)}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    Delete
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

function TextTabContent({
  textItems,
  selectedTextId,
  onSelectText,
  onAddText,
  onDeleteText,
}: {
  textItems: TextItem[];
  selectedTextId: string | null;
  onSelectText: (id: string) => void;
  onAddText: () => void;
  onDeleteText: (id: string) => void;
}) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Text Overlays
        </span>
        <button
          onClick={onAddText}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {(!textItems || textItems.length === 0) ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No text overlays yet.
          <br />
          Click + to add one.
        </div>
      ) : (
        <div className="space-y-1.5">
          {textItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectText(item.id)}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteText(item.id);
                  }}
                  className="text-slate-500 hover:text-red-400 p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {(item.duration_frames / 30).toFixed(1)}s @{" "}
                {(item.from_frame / 30).toFixed(1)}s
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
