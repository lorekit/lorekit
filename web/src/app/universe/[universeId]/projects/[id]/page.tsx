"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Clapperboard,
  Loader2,
  Film,
  Download,
  Sparkles,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScenePreview } from "@/components/editor/ScenePreview";
import { VideoPreview } from "@/components/editor/VideoPreview";
import { QuotePicker } from "@/components/editor/QuotePicker";
import { KeyframeCopyPopover } from "@/components/editor/KeyframeCopyPopover";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { LeftPanel, type LeftPanelTab } from "@/components/editor/LeftPanel";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { useProjectStore } from "@/stores/project-store";
import {
  getProject,
  getScenes,
  updateScene as updateSceneAPI,
  updateProject,
  generateClip,
  generateClips,
  generateKeyframe,
  generateCharacterImage,
  renderProject,
  copyKeyframe,
  publishToYouTube,
  getJob,
  clipUrl,
} from "@/lib/api";
import type { Scene, SourceItem, RenderOptions } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "outline" },
  story_ready: { label: "Story Ready", variant: "secondary" },
  generating: { label: "Generating", variant: "default" },
  clips_ready: { label: "Clips Ready", variant: "default" },
  assembling: { label: "Assembling", variant: "default" },
  rendered: { label: "Rendered", variant: "default" },
  published: { label: "Published", variant: "default" },
};

// ---------------------------------------------------------------------------
// Job polling helper
// ---------------------------------------------------------------------------

async function pollJob(
  jobId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<unknown> {
  const POLL_INTERVAL = 2000;
  const MAX_POLLS = 1500;

  for (let i = 0; i < MAX_POLLS; i++) {
    const job = await getJob(jobId);

    if (onProgress) {
      onProgress(job.progress, job.message);
    }

    if (job.status === "completed") {
      return job.result;
    }

    if (job.status === "failed") {
      throw new Error(job.message || "Job failed");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error("Job timed out");
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function EditorSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 h-12">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 rounded bg-slate-800 animate-pulse" />
          <div className="w-48 h-5 rounded bg-slate-800 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-16 h-5 rounded-full bg-slate-800 animate-pulse" />
          <div className="w-24 h-8 rounded bg-slate-800 animate-pulse" />
          <div className="w-20 h-8 rounded bg-slate-800 animate-pulse" />
        </div>
      </div>

      {/* Main area skeleton */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel */}
        <div className="w-[280px] border-r border-slate-800 p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-800 animate-pulse" />
          ))}
        </div>
        {/* Center */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="rounded-xl bg-slate-900 animate-pulse" style={{ aspectRatio: "9/16", height: "60vh" }} />
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="h-[180px] border-t border-slate-800 p-4">
        <div className="h-full rounded bg-slate-800/50 animate-pulse" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message, universeId }: { message: string; universeId: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 gap-6">
      <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
        <Film className="w-9 h-9 text-slate-600" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">Project Not Found</h2>
        <p className="text-sm text-slate-400 max-w-md">{message}</p>
      </div>
      <Button asChild variant="ghost">
        <Link href={`/universe/${universeId}/projects`}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-scene clip progress tracker
// ---------------------------------------------------------------------------

interface ClipJobState {
  sceneId: string;
  progress: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ProjectEditorPage({
  params,
}: {
  params: Promise<{ universeId: string; id: string }>;
}) {
  const { universeId, id } = use(params);

  // Store
  const project = useProjectStore((s) => s.project);
  const scenes = useProjectStore((s) => s.scenes);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const isLoading = useProjectStore((s) => s.isLoading);
  const isGenerating = useProjectStore((s) => s.isGenerating);
  const setProject = useProjectStore((s) => s.setProject);
  const setScenes = useProjectStore((s) => s.setScenes);
  const selectScene = useProjectStore((s) => s.selectScene);
  const updateSceneInStore = useProjectStore((s) => s.updateScene);
  const setLoading = useProjectStore((s) => s.setLoading);
  const setGenerating = useProjectStore((s) => s.setGenerating);
  const reset = useProjectStore((s) => s.reset);
  const selectedSceneFn = useProjectStore((s) => s.selectedScene);
  const totalDurationFn = useProjectStore((s) => s.totalDuration);

  // Local state
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [quotePickerOpen, setQuotePickerOpen] = useState(false);
  const [renderProgress, setRenderProgress] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [allClipsProgress, setAllClipsProgress] = useState<string | null>(null);
  const [clipJobs, setClipJobs] = useState<Record<string, ClipJobState>>({});
  const [generatingCharacter, setGeneratingCharacter] = useState(false);
  const [renderMenuOpen, setRenderMenuOpen] = useState(false);
  const [renderOpts, setRenderOpts] = useState<RenderOptions>({
    text_overlays: false,
    color_grade: true,
    audio: true,
  });
  const [activeLeftTab, setActiveLeftTab] = useState<LeftPanelTab>("properties");

  // Transitions state
  const [transitions, setTransitions] = useState<Record<number, string>>({});
  const [transitionsDirty, setTransitionsDirty] = useState(false);
  const [transitionsSaving, setTransitionsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderMenuRef = useRef<HTMLDivElement>(null);

  // Close render menu on outside click
  useEffect(() => {
    if (!renderMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (renderMenuRef.current && !renderMenuRef.current.contains(e.target as Node)) {
        setRenderMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [renderMenuOpen]);

  const selectedScene = selectedSceneFn();
  const totalDuration = totalDurationFn();

  // Count clips that exist
  const clipsGenerated = scenes.filter((s) => s.clip_url).length;
  const allClipsDone = scenes.length > 0 && clipsGenerated === scenes.length;

  // Parse transitions from project
  const initialTransitions = useMemo(() => {
    const raw = (project as unknown as Record<string, unknown> | null)?.transitions_json;
    if (!raw || typeof raw !== "string") return undefined;
    try {
      return JSON.parse(raw) as Array<{ scene_id: number; transition: string }>;
    } catch {
      return undefined;
    }
  }, [project]);

  // Sync transitions from project
  useEffect(() => {
    const map: Record<number, string> = {};
    if (initialTransitions) {
      for (const t of initialTransitions) {
        map[t.scene_id] = t.transition;
      }
    }
    setTransitions(map);
    setTransitionsDirty(false);
  }, [initialTransitions]);

  // ---------- Fetch project + scenes on mount ----------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [proj, projScenes] = await Promise.all([
          getProject(id),
          getScenes(id),
        ]);

        if (cancelled) return;

        setProject(proj);
        setScenes(projScenes);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load project. Please try again."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      reset();
    };
  }, [id, setProject, setScenes, setLoading, setError, reset]);

  // ---------- Refresh helper ----------
  const refreshProject = useCallback(async () => {
    try {
      const [proj, freshScenes] = await Promise.all([
        getProject(id),
        getScenes(id),
      ]);
      setProject(proj);
      setScenes(freshScenes);
    } catch {
      // silent
    }
  }, [id, setProject, setScenes]);

  // ---------- Handlers ----------

  const handleUpdateScene = useCallback(
    async (sceneId: string, updates: Partial<Scene>) => {
      updateSceneInStore(sceneId, updates);

      try {
        await updateSceneAPI(id, sceneId, updates);
      } catch {
        const freshScenes = await getScenes(id);
        setScenes(freshScenes);
      }
    },
    [id, updateSceneInStore, setScenes]
  );

  const handleRegenerateClip = useCallback(
    async (sceneId: string) => {
      setGenerating(true);
      setClipJobs((prev) => ({
        ...prev,
        [sceneId]: { sceneId, progress: 0, message: "Starting..." },
      }));

      try {
        const { job_id } = await generateClip(id, sceneId);
        await pollJob(job_id, (progress, message) => {
          setClipJobs((prev) => ({
            ...prev,
            [sceneId]: { sceneId, progress, message },
          }));
        });

        await refreshProject();
      } catch (err) {
        console.error("Clip generation failed:", err);
      } finally {
        setGenerating(false);
        setClipJobs((prev) => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });
      }
    },
    [id, setGenerating, refreshProject]
  );

  const handleGenerateKeyframe = useCallback(
    async (sceneId: string, sceneNum: number) => {
      setGenerating(true);
      setClipJobs((prev) => ({
        ...prev,
        [sceneId]: { sceneId, progress: 0, message: "Generating keyframe..." },
      }));

      try {
        const { job_id } = await generateKeyframe(id, sceneNum);
        await pollJob(job_id, (progress, message) => {
          setClipJobs((prev) => ({
            ...prev,
            [sceneId]: { sceneId, progress, message },
          }));
        });

        await refreshProject();
      } catch (err) {
        console.error("Keyframe generation failed:", err);
      } finally {
        setGenerating(false);
        setClipJobs((prev) => {
          const next = { ...prev };
          delete next[sceneId];
          return next;
        });
      }
    },
    [id, setGenerating, refreshProject]
  );

  const handleCopyKeyframe = useCallback(
    async (targetSceneIds: number[]) => {
      if (!selectedScene) return;
      const sourceId = selectedScene.scene_id ?? Number(selectedScene.id);
      await copyKeyframe(id, sourceId, targetSceneIds);
      await refreshProject();
    },
    [id, selectedScene, refreshProject]
  );

  const handleGenerateAllClips = useCallback(async () => {
    setGeneratingAll(true);
    setAllClipsProgress("Starting clip generation...");

    try {
      const { job_id } = await generateClips(id);
      let lastRefresh = 0;
      await pollJob(job_id, async (_progress, message) => {
        setAllClipsProgress(message || "Generating clips...");
        lastRefresh++;
        if (lastRefresh % 10 === 0) {
          refreshProject();
        }
      });

      await refreshProject();
    } catch (err) {
      console.error("Batch clip generation failed:", err);
    } finally {
      setGeneratingAll(false);
      setAllClipsProgress(null);
    }
  }, [id, refreshProject]);

  const handleRender = useCallback(async () => {
    if (!project) return;
    setIsRendering(true);
    setRenderMenuOpen(false);
    setRenderProgress("Starting render...");

    try {
      const { job_id } = await renderProject(id, renderOpts);
      await pollJob(job_id, (_progress, message) => {
        setRenderProgress(message || "Rendering...");
      });

      await refreshProject();
    } catch (err) {
      console.error("Render failed:", err);
    } finally {
      setIsRendering(false);
      setRenderProgress(null);
    }
  }, [id, project, refreshProject, renderOpts]);

  const handlePublish = useCallback(async () => {
    if (!project) return;
    setIsPublishing(true);

    try {
      await publishToYouTube(id);
      await refreshProject();
    } catch (err) {
      console.error("Publish failed:", err);
    } finally {
      setIsPublishing(false);
    }
  }, [id, project, refreshProject]);

  const handleGenerateCharacter = useCallback(async () => {
    if (!project) return;
    setGeneratingCharacter(true);
    try {
      await generateCharacterImage(project.id);
      await refreshProject();
    } catch (err) {
      console.error("Character generation failed:", err);
    } finally {
      setGeneratingCharacter(false);
    }
  }, [project, refreshProject]);

  const handleSelectQuote = useCallback(
    async (quote: SourceItem) => {
      if (!selectedScene) return;

      await handleUpdateScene(selectedScene.id, {
        quote_id: quote.id,
        text_overlay: quote.text,
      });
    },
    [selectedScene, handleUpdateScene]
  );

  // Transition management
  const saveTransitions = useCallback(
    async (transMap: Record<number, string>) => {
      setTransitionsSaving(true);
      try {
        const data = Object.entries(transMap).map(([sid, t]) => ({
          scene_id: Number(sid),
          transition: t,
        }));
        await updateProject(id, {
          transitions_json: JSON.stringify(data),
        } as never);
        setTransitionsDirty(false);
      } catch (err) {
        console.error("Failed to save transitions:", err);
      } finally {
        setTransitionsSaving(false);
      }
    },
    [id]
  );

  const handleTransitionChange = useCallback(
    (sceneId: number, transitionKey: string) => {
      setTransitions((prev) => {
        const next = { ...prev, [sceneId]: transitionKey };
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => saveTransitions(next), 1500);
        return next;
      });
      setTransitionsDirty(true);
    },
    [saveTransitions]
  );

  const handleSaveTransitions = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTransitions(transitions);
  }, [saveTransitions, transitions]);

  // Scene selection handler — also switches to Properties tab
  const handleSelectScene = useCallback(
    (sceneId: string) => {
      selectScene(sceneId);
    },
    [selectScene]
  );

  const handleSelectSceneFromList = useCallback(
    (sceneId: string) => {
      selectScene(sceneId);
      setActiveLeftTab("properties");
    },
    [selectScene]
  );

  // ---------- Loading state ----------
  if (isLoading) {
    return <EditorSkeleton />;
  }

  // ---------- Error state ----------
  if (error || !project) {
    return (
      <ErrorState
        message={error || "This project could not be found or may have been deleted."}
        universeId={universeId}
      />
    );
  }

  // ---------- Status config ----------
  const statusInfo = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft;

  return (
    <>
      <EditorLayout
        /* ============================================================ */
        /*  HEADER                                                       */
        /* ============================================================ */
        header={
          <header className="flex items-center justify-between px-4 h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm z-20 flex-shrink-0">
            {/* Left: Back + project name */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/universe/${universeId}`}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <div className="w-px h-5 bg-slate-800 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-white truncate">
                  {project.name}
                </h1>
              </div>
              <span className="text-[10px] text-slate-500 flex-shrink-0 hidden md:inline">
                {clipsGenerated}/{scenes.length} clips &middot; {formatDuration(totalDuration)}
              </span>
            </div>

            {/* Right: Progress + actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {(renderProgress || allClipsProgress) && (
                <span className="text-[10px] text-amber-400 animate-pulse max-w-40 truncate">
                  {allClipsProgress || renderProgress}
                </span>
              )}

              {/* Generate All Clips */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateAllClips}
                disabled={generatingAll || isGenerating || allClipsDone || scenes.length === 0}
                className="gap-1.5 text-xs"
              >
                {generatingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generatingAll
                  ? "Generating..."
                  : allClipsDone
                    ? "All Done"
                    : "Generate All"}
              </Button>

              {/* Render split button */}
              <div className="relative" ref={renderMenuRef}>
                <div className="flex">
                  <Button
                    size="sm"
                    onClick={handleRender}
                    disabled={isRendering || scenes.length === 0}
                    className="gap-1.5 text-xs rounded-r-none"
                  >
                    {isRendering ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Clapperboard className="w-3.5 h-3.5" />
                    )}
                    {isRendering ? "Rendering..." : "Render"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={isRendering || scenes.length === 0}
                    className="px-1.5 rounded-l-none border-l border-white/20"
                    onClick={() => setRenderMenuOpen((v) => !v)}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {renderMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl min-w-[200px] space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={renderOpts.text_overlays ?? true}
                        onChange={(e) => setRenderOpts((o) => ({ ...o, text_overlays: e.target.checked }))}
                        className="rounded"
                      />
                      Text overlays
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={renderOpts.color_grade ?? true}
                        onChange={(e) => setRenderOpts((o) => ({ ...o, color_grade: e.target.checked }))}
                        className="rounded"
                      />
                      Color grading
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={renderOpts.audio ?? true}
                        onChange={(e) => setRenderOpts((o) => ({ ...o, audio: e.target.checked }))}
                        className="rounded"
                      />
                      Audio
                    </label>
                  </div>
                )}
              </div>

              {/* Publish */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePublish}
                disabled={
                  isPublishing ||
                  !project.output_path ||
                  project.status === "published"
                }
                className="gap-1.5 text-xs"
              >
                {isPublishing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {isPublishing
                  ? "Publishing..."
                  : project.status === "published"
                    ? "Published"
                    : "Publish"}
              </Button>
            </div>
          </header>
        }

        /* ============================================================ */
        /*  LEFT PANEL                                                    */
        /* ============================================================ */
        leftPanel={
          <LeftPanel
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            onSelectScene={handleSelectSceneFromList}
            selectedScene={selectedScene}
            characters={project ? [{
              name: project.character_name || project.name?.split("—")[0]?.trim() || project.character_id || "Character",
              imageUrl: project.character_image_url || null,
            }] : undefined}
            onUpdateScene={handleUpdateScene}
            onRegenerateClip={handleRegenerateClip}
            isGenerating={isGenerating}
            projectId={id}
            transitions={transitions}
            onTransitionChange={handleTransitionChange}
            onSaveTransitions={handleSaveTransitions}
            transitionsDirty={transitionsDirty}
            transitionsSaving={transitionsSaving}
            audioMode={project.audio_mode}
            audioFilename={project.uploaded_audio_path}
            activeTab={activeLeftTab}
            onTabChange={setActiveLeftTab}
          />
        }

        /* ============================================================ */
        /*  CENTER PANEL                                                  */
        /* ============================================================ */
        centerPanel={
          <div className="flex flex-col h-full">
            {/* Preview area — centered, fills available space */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
              <div className="w-full max-w-md">
                <ScenePreview scene={selectedScene} />

                {/* Generation controls below preview */}
                {selectedScene && (
                  <div className="mt-3 space-y-3">
                    {/* Clip exists — show download + regenerate */}
                    {selectedScene.clip_url && (
                      <div className="flex flex-wrap gap-2 justify-center">
                        <a
                          href={clipUrl(selectedScene.clip_url)}
                          download={`scene_${selectedScene.scene_id ?? selectedScene.id}.mp4`}
                        >
                          <Button variant="secondary" size="sm" className="gap-2">
                            <Download className="w-4 h-4" />
                            Download
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleRegenerateClip(selectedScene.id)}
                          disabled={isGenerating}
                        >
                          <RotateCcw className="w-4 h-4" />
                          Regenerate Clip
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleGenerateKeyframe(selectedScene.id, selectedScene.scene_id ?? Number(selectedScene.id))}
                          disabled={isGenerating}
                        >
                          <Sparkles className="w-4 h-4" />
                          New Keyframe
                        </Button>
                        {selectedScene.keyframe_url && (
                          <KeyframeCopyPopover
                            scenes={scenes}
                            currentSceneId={selectedScene.scene_id ?? Number(selectedScene.id)}
                            onCopy={handleCopyKeyframe}
                            disabled={isGenerating}
                          />
                        )}
                      </div>
                    )}

                    {/* Keyframe exists but no clip */}
                    {!selectedScene.clip_url && selectedScene.keyframe_url && !clipJobs[selectedScene.id] && (
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                          onClick={() => handleRegenerateClip(selectedScene.id)}
                          disabled={isGenerating}
                          className="gap-2"
                          size="sm"
                        >
                          <Film className="w-4 h-4" />
                          Generate Clip
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleGenerateKeyframe(selectedScene.id, selectedScene.scene_id ?? Number(selectedScene.id))}
                          disabled={isGenerating}
                        >
                          <Sparkles className="w-4 h-4" />
                          New Keyframe
                        </Button>
                        <KeyframeCopyPopover
                          scenes={scenes}
                          currentSceneId={selectedScene.scene_id ?? Number(selectedScene.id)}
                          onCopy={handleCopyKeyframe}
                          disabled={isGenerating}
                        />
                      </div>
                    )}

                    {/* No keyframe and no clip */}
                    {!selectedScene.clip_url && !selectedScene.keyframe_url && !clipJobs[selectedScene.id] && (
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => handleGenerateKeyframe(selectedScene.id, selectedScene.scene_id ?? Number(selectedScene.id))}
                          disabled={isGenerating}
                          className="gap-2"
                          size="sm"
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate Keyframe
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerateClip(selectedScene.id)}
                          disabled={isGenerating}
                          className="gap-2 text-slate-400"
                        >
                          <Film className="w-4 h-4" />
                          Skip to Clip
                        </Button>
                      </div>
                    )}

                    {/* Progress bar for active generation */}
                    {clipJobs[selectedScene.id] && (
                      <div className="space-y-2 max-w-sm mx-auto">
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.round(clipJobs[selectedScene.id].progress * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-amber-400 text-center">
                          {clipJobs[selectedScene.id].message}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Video preview player (collapsible, at bottom of center) */}
            {scenes.some((s) => s.clip_url) && (
              <div className="flex-shrink-0 border-t border-slate-800">
                <VideoPreview
                  scenes={scenes}
                  transitions={initialTransitions
                    ? Object.fromEntries(initialTransitions.map((t) => [t.scene_id, t.transition]))
                    : {}
                  }
                />
              </div>
            )}
          </div>
        }

        /* ============================================================ */
        /*  TIMELINE                                                      */
        /* ============================================================ */
        timeline={
          <EditorTimeline
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            onSelectScene={handleSelectScene}
            transitions={transitions}
            onTransitionChange={handleTransitionChange}
            audioMode={project.audio_mode}
            audioFilename={project.uploaded_audio_path}
          />
        }
      />

      {/* ============================================================ */}
      {/*  QUOTE PICKER MODAL                                           */}
      {/* ============================================================ */}
      <QuotePicker
        open={quotePickerOpen}
        onOpenChange={setQuotePickerOpen}
        characterId={project.character_id}
        onSelectQuote={handleSelectQuote}
      />
    </>
  );
}
