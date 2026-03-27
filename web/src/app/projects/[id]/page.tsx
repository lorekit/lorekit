"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
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
import { SceneStrip } from "@/components/editor/SceneStrip";
import { SceneDetail } from "@/components/editor/SceneDetail";
import { ScenePreview } from "@/components/editor/ScenePreview";
import { Timeline } from "@/components/editor/Timeline";
import { QuotePicker } from "@/components/editor/QuotePicker";
import { StoryOverview } from "@/components/editor/StoryOverview";
import { KeyframeCopyPopover } from "@/components/editor/KeyframeCopyPopover";
import { useProjectStore } from "@/stores/project-store";
import {
  getProject,
  getScenes,
  updateScene as updateSceneAPI,
  generateClip,
  generateClips,
  generateKeyframe,
  generateCharacterImage,
  renderProject,
  copyKeyframe,
  publishToYouTube,
  getJob,
  clipUrl,
  API_BASE,
} from "@/lib/api";
import type { Scene, Quote, RenderOptions } from "@/lib/api";
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
  const MAX_POLLS = 1500; // ~50 minutes — enough for 7 scenes with keyframe generation

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

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-md bg-slate-800 animate-pulse" />
        <div className="w-56 h-6 rounded bg-slate-800 animate-pulse" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-20 h-6 rounded-full bg-slate-800 animate-pulse" />
        <div className="w-24 h-10 rounded-md bg-slate-800 animate-pulse" />
        <div className="w-24 h-10 rounded-md bg-slate-800 animate-pulse" />
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <HeaderSkeleton />

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel */}
        <div className="w-[60%] p-4">
          <div className="mx-auto rounded-xl bg-slate-900 animate-pulse" style={{ aspectRatio: "9/16", maxHeight: "55vh" }} />
        </div>
        {/* Right panel */}
        <div className="w-[40%] p-4 border-l border-slate-800 space-y-4">
          <div className="w-24 h-7 rounded-full bg-slate-800 animate-pulse" />
          <div className="w-full h-8 rounded bg-slate-800 animate-pulse" />
          <div className="w-full h-20 rounded bg-slate-800 animate-pulse" />
          <div className="w-full h-20 rounded bg-slate-800 animate-pulse" />
          <div className="w-full h-20 rounded bg-slate-800 animate-pulse" />
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="flex gap-1 h-10">
          {[40, 15, 20, 10, 10, 5].map((w, i) => (
            <div
              key={i}
              className="h-full rounded bg-slate-800 animate-pulse"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>

      {/* Scene strip skeleton */}
      <div className="border-t border-slate-800 p-3">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-32 flex-shrink-0 h-24 rounded-lg bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 gap-6">
      <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
        <Film className="w-9 h-9 text-slate-600" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">
          Project Not Found
        </h2>
        <p className="text-sm text-slate-400 max-w-md">{message}</p>
      </div>
      <Button asChild variant="ghost">
        <Link href="/projects">
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
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

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

        // Refresh scenes to get updated clip_url
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
        // Refresh scenes every 10 polls (~15s) to show newly completed clips
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
    async (quote: Quote) => {
      if (!selectedScene) return;

      await handleUpdateScene(selectedScene.id, {
        quote_id: quote.id,
        text_overlay: quote.text,
      });
    },
    [selectedScene, handleUpdateScene]
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
      />
    );
  }

  // ---------- Status config ----------
  const statusInfo = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      {/* ================================================================ */}
      {/*  HEADER BAR                                                      */}
      {/* ================================================================ */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm z-20 flex-shrink-0">
        {/* Left: Back + project name */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Back to projects"
          >
            <Link href="/projects">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>

          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">
              {project.name}
            </h1>
            {project.civilization && (
              <span className="text-xs text-slate-500">
                {project.philosopher_name} &middot;{" "}
                {formatDuration(totalDuration)} total &middot;{" "}
                {clipsGenerated}/{scenes.length} clips
              </span>
            )}
          </div>
        </div>

        {/* Right: Status + actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>

          {(renderProgress || allClipsProgress) && (
            <span className="text-xs text-amber-400 animate-pulse max-w-48 truncate">
              {allClipsProgress || renderProgress}
            </span>
          )}

          {/* Generate All Clips */}
          <Button
            variant="secondary"
            onClick={handleGenerateAllClips}
            disabled={generatingAll || isGenerating || allClipsDone || scenes.length === 0}
            className="gap-2"
          >
            {generatingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generatingAll
              ? "Generating..."
              : allClipsDone
                ? "All Clips Done"
                : "Generate All Clips"}
          </Button>

          {/* Render split button */}
          <div className="relative" ref={renderMenuRef}>
            <div className="flex">
              <Button
                onClick={handleRender}
                disabled={isRendering || scenes.length === 0}
                className="gap-2 rounded-r-none"
              >
                {isRendering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Clapperboard className="w-4 h-4" />
                )}
                {isRendering ? "Rendering..." : "Render"}
              </Button>
              <Button
                disabled={isRendering || scenes.length === 0}
                className="px-2 rounded-l-none border-l border-white/20"
                onClick={() => setRenderMenuOpen((v) => !v)}
              >
                <ChevronDown className="w-4 h-4" />
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
            onClick={handlePublish}
            disabled={
              isPublishing ||
              !project.output_path ||
              project.status === "published"
            }
            className="gap-2"
          >
            {isPublishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {isPublishing
              ? "Publishing..."
              : project.status === "published"
                ? "Published"
                : "Publish"}
          </Button>
        </div>
      </header>

      {/* ================================================================ */}
      {/*  MAIN CONTENT: Preview + Detail                                  */}
      {/* ================================================================ */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left panel: Scene Preview (60%) */}
        <section
          className="w-[60%] p-4 overflow-y-auto"
          aria-label="Scene preview"
        >
          <ScenePreview scene={selectedScene} />

          {/* ---- Two-step generation: Keyframe → Clip ---- */}
          {selectedScene && (
            <div className="mt-3 space-y-3">
              

              {/* Clip exists — show download + regenerate */}
              {selectedScene.clip_url && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={clipUrl(selectedScene.clip_url)}
                    download={`scene_${selectedScene.scene_id ?? selectedScene.id}.mp4`}
                  >
                    <Button variant="secondary" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Download Clip
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

              {/* Keyframe exists but no clip — show Generate Clip + New Keyframe + Copy */}
              {!selectedScene.clip_url && selectedScene.keyframe_url && !clipJobs[selectedScene.id] && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleRegenerateClip(selectedScene.id)}
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    <Film className="w-4 h-4" />
                    Generate Clip
                  </Button>
                  <Button
                    variant="ghost"
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

              {/* No keyframe and no clip — show both options */}
              {!selectedScene.clip_url && !selectedScene.keyframe_url && !clipJobs[selectedScene.id] && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleGenerateKeyframe(selectedScene.id, selectedScene.scene_id ?? Number(selectedScene.id))}
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Keyframe
                  </Button>
                  <Button
                    variant="ghost"
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
                <div className="space-y-2">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(clipJobs[selectedScene.id].progress * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-amber-400">
                    {clipJobs[selectedScene.id].message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Story overview below the preview */}
          {scenes.length > 0 && (
            <div className="mt-4">
              <StoryOverview scenes={scenes} totalDuration={totalDuration} />
            </div>
          )}

          {/* Download All section */}
          {clipsGenerated > 0 && (
            <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-300">
                  Downloads ({clipsGenerated}/{scenes.length} clips)
                </h3>
              </div>
              <div className="space-y-2">
                {scenes.map((scene, idx) => {
                  if (!scene.clip_url) return null;
                  return (
                    <div
                      key={scene.id}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/50"
                    >
                      <span className="text-sm text-slate-300">
                        Scene {idx + 1} &middot; {scene.beat}
                      </span>
                      <a
                        href={clipUrl(scene.clip_url)}
                        download={`scene_${scene.scene_id ?? idx + 1}.mp4`}
                      >
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </Button>
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Divider */}
        <div className="w-px bg-slate-800 flex-shrink-0" />

        {/* Right panel: Scene Detail (40%) */}
        <section
          className="w-[40%] p-4 overflow-y-auto"
          aria-label="Scene details"
        >
          <SceneDetail
            scene={selectedScene}
            characters={project ? [{
              name: project.philosopher_name || project.name?.split("—")[0]?.trim() || project.philosopher_id || "Philosopher",
              imageUrl: project.character_image_url || null,
            }] : undefined}
            onUpdate={handleUpdateScene}
            onRegenerate={handleRegenerateClip}
            isGenerating={isGenerating}
          />
        </section>
      </div>

      {/* ================================================================ */}
      {/*  SCENE STRIP                                                     */}
      {/* ================================================================ */}
      <SceneStrip
        scenes={scenes}
        selectedSceneId={selectedSceneId}
        onSelectScene={selectScene}
      />

      {/* ================================================================ */}
      {/*  QUOTE PICKER MODAL                                              */}
      {/* ================================================================ */}
      <QuotePicker
        open={quotePickerOpen}
        onOpenChange={setQuotePickerOpen}
        philosopherId={project.philosopher_id}
        onSelectQuote={handleSelectQuote}
      />
    </div>
  );
}
