"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clapperboard,
  Loader2,
  Film,
  Download,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Play,
  Plus,
  X,
  Scissors,
  Palette,
  Type,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScenePreview, type PreviewMode } from "@/components/editor/ScenePreview";
import { VideoPreview, type VideoPreviewHandle } from "@/components/editor/VideoPreview";
import { QuotePicker } from "@/components/editor/QuotePicker";

import { EditorLayout } from "@/components/editor/EditorLayout";
import { LeftPanel, type LeftPanelTab } from "@/components/editor/LeftPanel";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { SceneDetail } from "@/components/editor/SceneDetail";
import { TransitionDetail } from "@/components/editor/TransitionDetail";
import TextItemEditor from "@/components/editor/TextItemEditor";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

  downloadProjectFile,
  API_BASE,
  getJob,
  clipUrl,
  getCharacterReferenceImages,
  generateTransition,
  updateTransition as updateTransitionAPI,
  deleteScene,
  deleteTransition,
  extractFrame,
  setStartKeyframe,
  setEndKeyframe,
  setReferenceImages,
  addTextItem,
  updateTextItem,
  deleteTextItem,
} from "@/lib/api";
import type { Scene, Transition, SourceItem, RenderOptions, Environment, TextItem } from "@/lib/api";
import { getUniverseEnvironments, updateEnvironment, getProjectEffects, createProjectEffect, updateProjectEffect, getProjectRenders, deleteProjectRender } from "@/lib/api";
import type { RenderRecord } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

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
    <div className="flex flex-col h-screen bg-black">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-3 h-10 bg-black">
        <div className="flex items-center gap-3">
          <div className="w-20 h-6 rounded-md bg-slate-800 animate-pulse" />
          <div className="w-px h-5 bg-slate-800" />
          <div className="w-48 h-5 rounded bg-slate-800 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-7 rounded-md bg-slate-800 animate-pulse" />
          <div className="w-20 h-7 rounded-md bg-slate-800 animate-pulse" />
          <div className="w-20 h-7 rounded-md bg-amber-500/20 animate-pulse" />
          <div className="w-20 h-7 rounded-md bg-slate-800 animate-pulse" />
        </div>
      </div>

      {/* Main panels area */}
      <div className="flex-1 flex min-h-0 gap-1.5 px-1.5 pt-1.5">
        {/* Left panel */}
        <div className="w-[25%] bg-slate-900/80 rounded-lg p-3 space-y-2">
          {/* Tab bar skeleton */}
          <div className="flex gap-4 pb-2 border-b border-slate-800/50">
            <div className="w-14 h-4 rounded bg-slate-700 animate-pulse" />
            <div className="w-12 h-4 rounded bg-slate-800 animate-pulse" />
            <div className="w-12 h-4 rounded bg-slate-800 animate-pulse" />
          </div>
          {/* Scene list skeleton */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 animate-pulse">
              <div className="w-8 h-12 rounded bg-slate-700 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="w-16 h-3 rounded bg-slate-700" />
                <div className="w-24 h-2.5 rounded bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
        {/* Center */}
        <div className="flex-1 flex items-center justify-center bg-slate-900/80 rounded-lg">
          <div className="rounded-xl bg-slate-800/60 animate-pulse" style={{ aspectRatio: "9/16", height: "60vh" }} />
        </div>
        {/* Right panel */}
        <div className="w-[25%] bg-slate-900/80 rounded-lg p-3 space-y-3">
          {/* Tab bar skeleton */}
          <div className="flex gap-1 pb-2 border-b border-slate-800/50">
            <div className="flex-1 h-4 rounded bg-slate-700 animate-pulse" />
            <div className="flex-1 h-4 rounded bg-slate-800 animate-pulse" />
          </div>
          {/* Action buttons skeleton */}
          <div className="w-20 h-3 rounded bg-slate-800 animate-pulse" />
          <div className="h-8 rounded-md bg-slate-800/60 animate-pulse" />
          <div className="h-8 rounded-md bg-slate-800/40 animate-pulse" />
          <div className="h-8 rounded-md bg-slate-800/40 animate-pulse" />
        </div>
      </div>

      {/* Timeline skeleton */}
      <div className="px-1.5 pb-1.5 pt-1.5">
        <div className="bg-slate-900/80 rounded-lg p-3 space-y-2">
          <div className="flex justify-between">
            <div className="w-16 h-3 rounded bg-slate-800 animate-pulse" />
            <div className="w-20 h-3 rounded bg-slate-800 animate-pulse" />
          </div>
          <div className="h-14 rounded bg-slate-800/50 animate-pulse" />
          <div className="h-8 rounded bg-slate-800/30 animate-pulse" />
        </div>
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
        <Link href={`/app/universe/${universeId}/projects`}>
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

/* ------------------------------------------------------------------ */
/*  Transition Preview (center panel when a transition is selected)    */
/* ------------------------------------------------------------------ */

function TransitionPreview({
  fromSceneId,
  toSceneId,
  transitionClips,
  speed = 1.0,
}: {
  fromSceneId: number;
  toSceneId: number;
  transitionClips: Record<string, { clip_path?: string; prompt?: string }>;
  speed?: number;
}) {
  const key = `${fromSceneId}_${toSceneId}`;
  const clip = transitionClips[key];

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Preview area — 9:16 vertical */}
      <div className="relative bg-slate-950 mx-auto" style={{ aspectRatio: "9/16" }}>
        {clip?.clip_path ? (
          <video
            key={clip.clip_path}
            controls
            src={clipUrl(`/files/${clip.clip_path}`)}
            className="w-full h-full object-cover"
            preload="metadata"
            onLoadedMetadata={(e) => {
              if (speed !== 1.0) (e.target as HTMLVideoElement).playbackRate = speed;
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-800">
            <Sparkles className="w-10 h-10 text-slate-600" />
            <p className="text-sm text-slate-500">No transition generated</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const setTransitions = useProjectStore((s) => s.setTransitions);
  const transitions = useProjectStore((s) => s.transitions);
  const selectScene = useProjectStore((s) => s.selectScene);
  const selectElement = useProjectStore((s) => s.selectElement);
  const selectedElement = useProjectStore((s) => s.selectedElement);
  const updateSceneInStore = useProjectStore((s) => s.updateScene);
  const updateTransitionInStore = useProjectStore((s) => s.updateTransition);
  const selectedTransitionFn = useProjectStore((s) => s.selectedTransition);
  const setLoading = useProjectStore((s) => s.setLoading);
  const setGenerating = useProjectStore((s) => s.setGenerating);
  const reset = useProjectStore((s) => s.reset);
  const selectedSceneFn = useProjectStore((s) => s.selectedScene);
  const totalDurationFn = useProjectStore((s) => s.totalDuration);
  const textItems = useProjectStore((s) => s.textItems);
  const setTextItems = useProjectStore((s) => s.setTextItems);
  const addTextItemLocal = useProjectStore((s) => s.addTextItemLocal);
  const updateTextItemLocal = useProjectStore((s) => s.updateTextItemLocal);
  const removeTextItemLocal = useProjectStore((s) => s.removeTextItemLocal);
  const selectedTextItem = useProjectStore((s) => s.selectedTextItem());

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ sceneId: string; sceneNum: number } | null>(null);
  const [transitionDeleteConfirm, setTransitionDeleteConfirm] = useState<{ from: number; to: number } | null>(null);
  const [renderMenuOpen, setRenderMenuOpen] = useState(false);
  const [renderOpts, setRenderOpts] = useState<RenderOptions>({
    text_overlays: true,
    color_grade: true,
    audio: true,
  });
  const [activeLeftTab, setActiveLeftTab] = useState<LeftPanelTab>("script");
  const [activeRightTab, setActiveRightTab] = useState<"clip" | "keyframe">("clip");
  // Reference images are per-scene (stored as materials in timeline)
  const [previewMode, setPreviewMode] = useState<PreviewMode>("keyframe");
  const [extractingFrame, setExtractingFrame] = useState(false);
  const [endKeyframePicker, setEndKeyframePicker] = useState(false);
  const [startKeyframePicker, setStartKeyframePicker] = useState(false);
  const [refImagePicker, setRefImagePicker] = useState(false);
  const videoTimeRef = useRef(0);
  const videoPreviewRef = useRef<VideoPreviewHandle>(null);
  const textOverlayRef = useRef<HTMLDivElement>(null);
  const [textContainerHeight, setTextContainerHeight] = useState(640);
  const REFERENCE_HEIGHT = 1280; // font_size is defined in pixels at this reference height
  // Measure text overlay container so font sizes scale proportionally
  useEffect(() => {
    const el = textOverlayRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setTextContainerHeight(entry.contentRect.height || 640));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<number | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [actualSegments, setActualSegments] = useState<import("@/components/editor/VideoPreview").SegmentTiming[]>();
  const [actualTotalDuration, setActualTotalDuration] = useState<number>();
  const [characterRefUrls, setCharacterRefUrls] = useState<string[]>([]);
  const [fullVideoTab, setFullVideoTab] = useState<"output" | "color" | "text" | "audio">("output");
  // Auto-switch to text tab when a text item is selected
  useEffect(() => {
    if (selectedElement?.type === "text") setFullVideoTab("text");
  }, [selectedElement]);
  const [colorGrade, setColorGrade] = useState({ temperature: 6500, saturation: 1.05, contrast: 1.1, vignette: 0.3 });
  const [audioVolume, setAudioVolume] = useState(100);
  const [renders, setRenders] = useState<RenderRecord[]>([]);

  // All available keyframe images for pickers (current + history + extracted frames)
  const pickerImages = useMemo(() => {
    const images: Array<{ url: string; path: string | null; label: string }> = [];
    const seen = new Set<string>();
    for (const s of scenes) {
      // Current keyframe
      const displayUrl = s.keyframe_path ? `/files/${s.keyframe_path}` : s.keyframe_url;
      if (displayUrl && !seen.has(displayUrl)) {
        seen.add(displayUrl);
        images.push({ url: displayUrl, path: s.keyframe_path ?? null, label: `Scene ${s.scene_id ?? "?"}` });
      }
      // History
      for (const h of s.keyframe_history ?? []) {
        const hUrl = h.path ? `/files/${h.path}` : h.url;
        if (hUrl && !seen.has(hUrl)) {
          seen.add(hUrl);
          images.push({ url: hUrl, path: h.path ?? null, label: `Scene ${s.scene_id ?? "?"}` });
        }
      }
      // Extracted frames
      for (const f of s.extracted_frames ?? []) {
        const fUrl = f.path ? `/files/${f.path}` : f.url;
        if (fUrl && !seen.has(fUrl)) {
          seen.add(fUrl);
          images.push({ url: fUrl, path: f.path ?? null, label: `S${s.scene_id} frame` });
        }
      }
    }
    return images;
  }, [scenes]);
  const [generatingTransition, setGeneratingTransition] = useState(false);

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
  const selectedTransition = selectedTransitionFn();
  const totalDuration = totalDurationFn();

  // Transition clips are inline in the transitions array (from timeline).
  // Build a compat map keyed by "fromSceneId_toSceneId" for existing UI components.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsedTransitionClips: Record<string, any> | undefined = useMemo(
    () => {
      if (!transitions || transitions.length === 0) return undefined;
      const map: Record<string, any> = {};
      for (const t of transitions) {
        if (t.clip_path) {
          const key = `${t.from_scene_id}_${t.to_scene_id}`;
          map[key] = { clip_path: t.clip_path, clip_url: t.clip_url };
        }
      }
      return Object.keys(map).length > 0 ? map : undefined;
    },
    [transitions]
  );

  // Count clips that exist
  const clipsGenerated = scenes.filter((s) => s.clip_url || s.clip_path).length;
  const allClipsDone = scenes.length > 0 && clipsGenerated === scenes.length;

  // Parse transitions from project
  // ---------- Fetch project + scenes on mount ----------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [proj, scenesData] = await Promise.all([
          getProject(id),
          getScenes(id),
        ]);

        if (cancelled) return;

        setProject(proj);
        setScenes(scenesData.scenes);
        setTransitions(scenesData.transitions);
        setTextItems(scenesData.text_items ?? []);
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
  }, [id, setProject, setScenes, setTransitions, setTextItems, setLoading, setError, reset]);

  // Fetch character reference images when project loads
  useEffect(() => {
    if (!project?.character_id) return;
    getCharacterReferenceImages(project.character_id)
      .then((data) => setCharacterRefUrls(data.urls))
      .catch(() => {});
  }, [project?.character_id]);

  // Load color grade effect for this project
  const [colorGradeEffectId, setColorGradeEffectId] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    getProjectEffects(id)
      .then(async (effects) => {
        const existing = effects.find((e) => e.effect_type === "color_grade");
        if (!existing) {
          // Create default color grade effect, using environment defaults if available
          let defaults = { temperature: 6500, saturation: 1.05, contrast: 1.1, vignette: 0.3 };
          if (universeId) {
            try {
              const envs = await getUniverseEnvironments(universeId);
              if (envs.length > 0 && envs[0].color_grade_json) {
                defaults = { ...defaults, ...JSON.parse(envs[0].color_grade_json) };
              }
            } catch { /* */ }
          }
          const created = await createProjectEffect(id, {
            effect_type: "color_grade",
            name: "Color Grade",
            settings_json: JSON.stringify(defaults),
          });
          setColorGrade(defaults);
          setColorGradeEffectId(created.id);
        } else {
          try {
            setColorGrade((prev) => ({ ...prev, ...JSON.parse(existing.settings_json) }));
          } catch { /* */ }
          setColorGradeEffectId(existing.id);
        }
      })
      .catch(() => {});
  }, [id, universeId]);

  // Fetch render history
  useEffect(() => {
    if (!id) return;
    getProjectRenders(id).then((data) => setRenders(data.renders)).catch(() => {});
  }, [id]);

  // Load audio duration for timeline
  useEffect(() => {
    if (!project?.uploaded_audio_path) { setAudioDuration(0); return; }
    const audio = new Audio(clipUrl(`/files/${project.uploaded_audio_path}`));
    audio.onloadedmetadata = () => setAudioDuration(audio.duration);
    audio.onerror = () => setAudioDuration(0);
  }, [project?.uploaded_audio_path]);

  // ---------- Refresh helper ----------
  const handleColorGradeChange = useCallback((key: string, value: number) => {
    setColorGrade((prev) => {
      const next = { ...prev, [key]: value };
      if (colorGradeEffectId) {
        updateProjectEffect(id, colorGradeEffectId, { settings_json: JSON.stringify(next) }).catch(() => {});
      }
      return next;
    });
  }, [colorGradeEffectId, id]);

  const refreshProject = useCallback(async () => {
    try {
      const [proj, scenesData] = await Promise.all([
        getProject(id),
        getScenes(id),
      ]);
      setProject(proj);
      setScenes(scenesData.scenes);
      setTransitions(scenesData.transitions);
      setTextItems(scenesData.text_items ?? []);
    } catch {
      // silent
    }
  }, [id, setProject, setScenes, setTransitions, setTextItems]);

  // ---------- Handlers ----------

  const handleUpdateScene = useCallback(
    async (sceneId: string, updates: Partial<Scene>) => {
      updateSceneInStore(sceneId, updates);

      try {
        await updateSceneAPI(id, sceneId, updates);
      } catch {
        const scenesData = await getScenes(id);
        setScenes(scenesData.scenes);
        setTransitions(scenesData.transitions);
        setTextItems(scenesData.text_items ?? []);
      }
    },
    [id, updateSceneInStore, setScenes, setTransitions, setTextItems]
  );

  const handleUpdateTransition = useCallback(
    async (fromSceneId: number, toSceneId: number, updates: Partial<Transition>) => {
      updateTransitionInStore(fromSceneId, toSceneId, updates);
      try {
        await updateTransitionAPI(id, fromSceneId, toSceneId, updates);
      } catch {
        const scenesData = await getScenes(id);
        setScenes(scenesData.scenes);
        setTransitions(scenesData.transitions);
        setTextItems(scenesData.text_items ?? []);
      }
    },
    [id, updateTransitionInStore, setScenes, setTransitions, setTextItems]
  );

  // ---------- Text overlay handlers ----------

  const handleAddText = useCallback(async () => {
    try {
      const item = await addTextItem(id, { text: "New Text" });
      addTextItemLocal(item);
      selectElement({ type: "text", id: item.id });
    } catch (err) { console.error("Failed to add text:", err); }
  }, [id, addTextItemLocal, selectElement]);

  const handleUpdateText = useCallback(async (textId: string, updates: Partial<TextItem>) => {
    updateTextItemLocal(textId, updates);
    try {
      await updateTextItem(id, textId, updates);
    } catch (err) { console.error("Failed to update text:", err); }
  }, [id, updateTextItemLocal]);

  const handleDeleteText = useCallback(async (textId: string) => {
    removeTextItemLocal(textId);
    try {
      await deleteTextItem(id, textId);
    } catch (err) { console.error("Failed to delete text:", err); }
  }, [id, removeTextItemLocal]);

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
        // Use per-scene reference images
        const scene = scenes.find((s) => s.id === sceneId);
        const refs = scene?.reference_images;
        const { job_id } = await generateKeyframe(id, sceneNum, refs && refs.length > 0 ? refs : undefined);
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
    [id, scenes, setGenerating, refreshProject]
  );

  const handleExtractFrame = useCallback(
    async () => {
      if (!selectedScene) return;
      const sceneNum = selectedScene.scene_id ?? Number(selectedScene.id);
      const timestamp = videoTimeRef.current;
      setExtractingFrame(true);
      try {
        await extractFrame(id, sceneNum, timestamp);
        await refreshProject();
      } catch (err) {
        console.error("Frame extraction failed:", err);
      } finally {
        setExtractingFrame(false);
      }
    },
    [id, selectedScene, refreshProject]
  );

  const handleSetStartKeyframe = useCallback(
    async (url: string, path?: string | null) => {
      if (!selectedScene) return;
      const sceneNum = selectedScene.scene_id ?? Number(selectedScene.id);
      try {
        await setStartKeyframe(id, sceneNum, url, path ?? null);
        await refreshProject();
      } catch (err) {
        console.error("Failed to set start keyframe:", err);
      }
    },
    [id, selectedScene, refreshProject]
  );

  const handleSetEndKeyframe = useCallback(
    async (url: string | null) => {
      if (!selectedScene) return;
      const sceneNum = selectedScene.scene_id ?? Number(selectedScene.id);
      try {
        await setEndKeyframe(id, sceneNum, url);
        await refreshProject();
      } catch (err) {
        console.error("Failed to set end keyframe:", err);
      }
    },
    [id, selectedScene, refreshProject]
  );

  const handleSetReferenceImages = useCallback(
    async (urls: string[]) => {
      if (!selectedScene) return;
      const sceneNum = selectedScene.scene_id ?? Number(selectedScene.id);
      try {
        await setReferenceImages(id, sceneNum, urls);
        await refreshProject();
      } catch (err) {
        console.error("Failed to set reference images:", err);
      }
    },
    [id, selectedScene, refreshProject]
  );

  const handleDeleteScene = useCallback(
    (sceneId: string, sceneNum: number) => {
      setDeleteConfirm({ sceneId, sceneNum });
    },
    []
  );

  const confirmDeleteScene = useCallback(
    async () => {
      if (!deleteConfirm) return;
      const { sceneId, sceneNum } = deleteConfirm;
      try {
        await deleteScene(id, sceneNum);
        if (selectedScene?.id === sceneId) {
          selectScene(null);
        }
        await refreshProject();
      } catch (err) {
        console.error("Failed to delete scene:", err);
      }
    },
    [id, deleteConfirm, selectedScene, selectScene, refreshProject]
  );

  const handleDeleteTransition = useCallback(
    (fromSceneId: number, toSceneId: number) => {
      setTransitionDeleteConfirm({ from: fromSceneId, to: toSceneId });
    },
    []
  );

  const confirmDeleteTransition = useCallback(
    async () => {
      if (!transitionDeleteConfirm) return;
      try {
        await deleteTransition(id, transitionDeleteConfirm.from, transitionDeleteConfirm.to);
        await refreshProject();
      } catch (err) {
        console.error("Failed to delete transition:", err);
      }
    },
    [id, transitionDeleteConfirm, refreshProject]
  );

  const handleGenerateAllClips = useCallback(async () => {
    setGeneratingAll(true);
    setAllClipsProgress("Starting clip generation...");

    try {
      // Step 1: Generate all scene clips
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

      // Step 2: Generate AI transitions between all adjacent clips
      const freshData = await getScenes(id);
      setScenes(freshData.scenes);
      setTransitions(freshData.transitions);
      setTextItems(freshData.text_items ?? []);
      const clippedScenes = freshData.scenes.filter((s) => s.clip_url);
      if (clippedScenes.length > 1) {
        setAllClipsProgress("Generating AI transitions...");
        for (let i = 0; i < clippedScenes.length - 1; i++) {
          const fromNum = clippedScenes[i].scene_id ?? i + 1;
          const toNum = clippedScenes[i + 1].scene_id ?? i + 2;
          setAllClipsProgress(`Generating transition ${fromNum} → ${toNum}...`);
          try {
            const { job_id: transJobId } = await generateTransition(id, fromNum, toNum);
            await pollJob(transJobId, () => {});
          } catch (err) {
            console.error(`Transition ${fromNum}→${toNum} failed:`, err);
          }
        }
        await refreshProject();
      }
    } catch (err) {
      console.error("Batch generation failed:", err);
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
      // Refresh render history
      getProjectRenders(id).then((data) => setRenders(data.renders)).catch(() => {});
    } catch (err) {
      console.error("Render failed:", err);
    } finally {
      setIsRendering(false);
      setRenderProgress(null);
    }
  }, [id, project, refreshProject, renderOpts]);

  const handleGenerateTransition = useCallback(
    async (fromSceneId: number, toSceneId: number, prompt?: string) => {
      setGeneratingTransition(true);
      try {
        const { job_id } = await generateTransition(id, fromSceneId, toSceneId, prompt);
        await pollJob(job_id, () => {});
        await refreshProject();
      } catch (err) {
        console.error("Transition generation failed:", err);
      } finally {
        setGeneratingTransition(false);
      }
    },
    [id, refreshProject]
  );

  const handleDownload = useCallback(async () => {
    if (!project) return;
    setIsPublishing(true);

    try {
      const { url } = await downloadProjectFile(id, "render");
      // Open the download URL — for local mode this is a /files/ path,
      // for cloud mode it's a signed Supabase URL
      const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
      window.open(fullUrl, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsPublishing(false);
    }
  }, [id, project]);

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
    },
    [selectScene]
  );

  const handleSelectTransition = useCallback(
    (from: number, to: number) => {
      selectElement({ type: "transition", fromSceneId: from, toSceneId: to });
    },
    [selectElement]
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
          <header className="flex items-center justify-between px-3 h-10 bg-black z-20 flex-shrink-0">
            {/* Left: Back + project name */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/app/universe/${universeId}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-md px-2.5 py-1.5 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
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

              {/* Preview — selects Full Video in script panel */}
              {scenes.some((s) => s.clip_url) && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => { selectElement({ type: "full-video" }); setActiveLeftTab("script"); }}
                  className="gap-1.5"
                >
                  <Play className="w-3 h-3" />
                  Preview
                </Button>
              )}

              {/* Generate All Clips — hidden when all done */}
              {(!allClipsDone || generatingAll) && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={handleGenerateAllClips}
                  disabled={generatingAll || isGenerating || scenes.length === 0}
                  className="gap-1.5"
                >
                  {generatingAll ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {generatingAll ? "Generating..." : "Generate All"}
                </Button>
              )}

              {/* Render split button */}
              <div className="relative" ref={renderMenuRef}>
                <div className="flex">
                  <Button
                    size="xs"
                    onClick={handleRender}
                    disabled={isRendering || scenes.length === 0}
                    className="gap-1.5 rounded-r-none"
                  >
                    {isRendering ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Clapperboard className="w-3 h-3" />
                    )}
                    {isRendering ? "Rendering..." : "Render"}
                  </Button>
                  <Button
                    size="xs"
                    disabled={isRendering || scenes.length === 0}
                    className="px-1 rounded-l-none border-l border-white/20"
                    onClick={() => setRenderMenuOpen((v) => !v)}
                  >
                    <ChevronDown className="w-3 h-3" />
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

              {/* Download */}
              <Button
                variant="secondary"
                size="xs"
                onClick={handleDownload}
                disabled={
                  isPublishing ||
                  !project.output_path ||
                  project.status !== "rendered"
                }
                className="gap-1.5"
              >
                {isPublishing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                {isPublishing ? "Downloading..." : "Download"}
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
            isFullVideoSelected={selectedElement?.type === "full-video"}
            onSelectFullVideo={() => selectElement({ type: "full-video" })}
            totalDuration={actualTotalDuration ?? totalDuration}
            characters={project ? [{
              name: project.character_name || project.name?.split("—")[0]?.trim() || project.character_id || "Character",
              imageUrl: project.character_image_url ? clipUrl(project.character_image_url) : null,
            }] : undefined}
            onDeleteScene={handleDeleteScene}
            onDeleteTransition={handleDeleteTransition}
            selectedTransition={selectedTransition}
            onSelectTransition={handleSelectTransition}
            transitionClips={parsedTransitionClips}
            audioFilename={project.uploaded_audio_path}
            characterPortraitUrl={project.character_image_url}
            activeTab={activeLeftTab}
            onTabChange={setActiveLeftTab}
            onViewProperties={() => setActiveRightTab("clip")}
            renders={renders}
            onDownloadRender={async (path) => {
              try {
                const url = clipUrl(`/files/${path}`);
                const res = await fetch(url);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = path.split("/").pop() || "render.mp4";
                a.click();
                URL.revokeObjectURL(blobUrl);
              } catch {
                // Fallback: open in new tab
                window.open(clipUrl(`/files/${path}`), "_blank");
              }
            }}
            onDeleteRender={async (jobId) => {
              try {
                await deleteProjectRender(id, jobId);
                setRenders((prev) => prev.filter((r) => r.id !== jobId));
              } catch { /* */ }
            }}
            textItems={textItems}
            selectedTextId={selectedElement?.type === "text" ? selectedElement.id : null}
            onSelectText={(textId) => selectElement({ type: "text", id: textId })}
            onAddText={handleAddText}
            onDeleteText={handleDeleteText}
          />
        }

        /* ============================================================ */
        /*  CENTER PANEL                                                  */
        /* ============================================================ */
        centerPanel={
          <div className="flex flex-col h-full">
            {/* Preview area — centered, fills available space */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
              <div className="w-full flex justify-center">
                {/* VideoPreview always mounted (hidden when not active) so it measures clip durations for the timeline */}
                <div className={selectedElement?.type === "full-video" || selectedElement?.type === "text" ? "w-[min(60vh*9/16,400px)] relative" : "hidden"}>
                  <VideoPreview
                    ref={videoPreviewRef}
                    scenes={scenes}
                    transitionClips={parsedTransitionClips}
                    audioUrl={project?.uploaded_audio_path ? `/files/${project.uploaded_audio_path}` : null}
                    onProgressUpdate={setPlaybackProgress}
                    onSegmentsReady={(segs, dur) => { setActualSegments(segs); setActualTotalDuration(dur); }}
                    colorGrade={(renderOpts.color_grade ?? true) ? colorGrade : null}
                    audioDuration={audioDuration}
                  />
                  {/* Text overlay layer — renders text items over the video preview, draggable + resizable when selected */}
                  {(renderOpts.text_overlays ?? true) && textItems.length > 0 && (
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ aspectRatio: "9/16" }}
                      ref={textOverlayRef}
                    >
                      {/* Center guide lines — only shown while actively dragging */}
                      {isDraggingText && selectedElement?.type === "text" && (() => {
                        const sel = textItems.find((t) => t.id === (selectedElement as { type: "text"; id: string }).id);
                        if (!sel) return null;
                        const SNAP = 0.02;
                        const nearCenterX = Math.abs(sel.position.x - 0.5) < SNAP;
                        const nearCenterY = Math.abs(sel.position.y - 0.5) < SNAP;
                        return (
                          <>
                            {nearCenterX && <div className="absolute top-0 bottom-0 left-1/2 w-px bg-amber-400/50 pointer-events-none z-20" />}
                            {nearCenterY && <div className="absolute left-0 right-0 top-1/2 h-px bg-amber-400/50 pointer-events-none z-20" />}
                          </>
                        );
                      })()}

                      {textItems.filter((t) => t.enabled).map((item) => {
                        const totalDur = totalDurationFn();
                        const currentTime = (playbackProgress ?? 0) * totalDur;
                        const itemStart = item.from_frame / 30;
                        const itemEnd = (item.from_frame + item.duration_frames) / 30;
                        const visible = currentTime >= itemStart && currentTime < itemEnd;
                        if (!visible) return null;
                        const isSelected = selectedElement?.type === "text" && selectedElement.id === item.id;
                        const containerWidth = item.width ?? 0.8;
                        return (
                          <div
                            key={item.id}
                            className={`absolute select-none ${isSelected ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
                            style={{
                              left: `${item.position.x * 100}%`,
                              top: `${item.position.y * 100}%`,
                              transform: "translate(-50%, -50%)",
                              width: `${containerWidth * 100}%`,
                            }}
                            onDoubleClick={isSelected ? (e) => {
                              e.stopPropagation();
                              setEditingTextId(item.id);
                            } : undefined}
                            onMouseDown={isSelected ? (e) => {
                              if ((e.target as HTMLElement).dataset.resize) return;
                              if (editingTextId === item.id) return;
                              e.preventDefault();
                              const container = textOverlayRef.current;
                              if (!container) return;
                              const rect = container.getBoundingClientRect();
                              const SNAP = 0.02;
                              const DRAG_THRESHOLD = 4; // px — must move this far before it counts as a drag
                              const startX = e.clientX;
                              const startY = e.clientY;
                              let didDrag = false;
                              const onMove = (ev: MouseEvent) => {
                                if (!didDrag) {
                                  const dx = ev.clientX - startX;
                                  const dy = ev.clientY - startY;
                                  if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
                                  didDrag = true;
                                  setIsDraggingText(true);
                                }
                                let x = (ev.clientX - rect.left) / rect.width;
                                let y = (ev.clientY - rect.top) / rect.height;
                                if (Math.abs(x - 0.5) < SNAP) x = 0.5;
                                if (Math.abs(y - 0.5) < SNAP) y = 0.5;
                                x = Math.max(0, Math.min(1, x));
                                y = Math.max(0, Math.min(1, y));
                                updateTextItemLocal(item.id, { position: { x, y } });
                              };
                              const onUp = (ev: MouseEvent) => {
                                window.removeEventListener("mousemove", onMove);
                                window.removeEventListener("mouseup", onUp);
                                setIsDraggingText(false);
                                if (!didDrag) return; // click without drag — don't move
                                let x = (ev.clientX - rect.left) / rect.width;
                                let y = (ev.clientY - rect.top) / rect.height;
                                if (Math.abs(x - 0.5) < SNAP) x = 0.5;
                                if (Math.abs(y - 0.5) < SNAP) y = 0.5;
                                x = Math.max(0, Math.min(1, x));
                                y = Math.max(0, Math.min(1, y));
                                handleUpdateText(item.id, { position: { x, y } });
                              };
                              window.addEventListener("mousemove", onMove);
                              window.addEventListener("mouseup", onUp);
                            } : undefined}
                          >
                            {/* Text content — inline editable on double-click */}
                            {isSelected && editingTextId === item.id ? (
                              <textarea
                                ref={(el) => {
                                  if (el) {
                                    el.focus();
                                    el.selectionStart = el.selectionEnd = el.value.length;
                                    // Auto-size to content
                                    el.style.height = "auto";
                                    el.style.height = el.scrollHeight + "px";
                                  }
                                }}
                                defaultValue={item.text}
                                className="w-full bg-transparent border-none outline-none resize-none ring-2 ring-amber-400 rounded px-2 py-1"
                                style={{
                                  fontFamily: item.font_family,
                                  fontSize: `${item.font_size / REFERENCE_HEIGHT * textContainerHeight}px`,
                                  color: item.color,
                                  textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.6)",
                                  WebkitFontSmoothing: "auto",
                                  MozOsxFontSmoothing: "auto",
                                  textAlign: "center",
                                  lineHeight: 1.3,
                                  caretColor: "white",
                                  overflow: "hidden",
                                }}
                                onInput={(e) => {
                                  const el = e.target as HTMLTextAreaElement;
                                  el.style.height = "auto";
                                  el.style.height = el.scrollHeight + "px";
                                }}
                                onBlur={(e) => {
                                  setEditingTextId(null);
                                  if (e.target.value !== item.text) {
                                    handleUpdateText(item.id, { text: e.target.value });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setEditingTextId(null);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div
                                className={isSelected ? "ring-2 ring-amber-400/60 rounded px-2 py-1" : ""}
                                style={{
                                  fontFamily: item.font_family,
                                  fontSize: `${item.font_size / REFERENCE_HEIGHT * textContainerHeight}px`,
                                  color: item.color,
                                  textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.6)",
                                  WebkitFontSmoothing: "auto",
                                  MozOsxFontSmoothing: "auto",
                                  textAlign: "center",
                                  lineHeight: 1.3,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {item.text}
                              </div>
                            )}

                            {/* Resize handles — left/right edges to change container width */}
                            {isSelected && (
                              <>
                                {/* Left edge */}
                                <div
                                  data-resize="left"
                                  className="absolute top-0 bottom-0 -left-1 w-2 cursor-ew-resize hover:bg-amber-400/20 flex items-center justify-center"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const container = textOverlayRef.current;
                                    if (!container) return;
                                    const containerRect = container.getBoundingClientRect();
                                    const startX = e.clientX;
                                    const startWidth = containerWidth;
                                    const onMove = (ev: MouseEvent) => {
                                      const deltaPx = startX - ev.clientX;
                                      const deltaFrac = (deltaPx / containerRect.width) * 2;
                                      const newW = Math.max(0.1, Math.min(1.0, startWidth + deltaFrac));
                                      updateTextItemLocal(item.id, { width: Math.round(newW * 100) / 100 });
                                    };
                                    const onUp = (ev: MouseEvent) => {
                                      window.removeEventListener("mousemove", onMove);
                                      window.removeEventListener("mouseup", onUp);
                                      const deltaPx = startX - ev.clientX;
                                      const deltaFrac = (deltaPx / containerRect.width) * 2;
                                      const newW = Math.max(0.1, Math.min(1.0, startWidth + deltaFrac));
                                      handleUpdateText(item.id, { width: Math.round(newW * 100) / 100 });
                                    };
                                    window.addEventListener("mousemove", onMove);
                                    window.addEventListener("mouseup", onUp);
                                  }}
                                >
                                  <div className="w-0.5 h-6 bg-amber-400 rounded-full" />
                                </div>
                                {/* Right edge */}
                                <div
                                  data-resize="right"
                                  className="absolute top-0 bottom-0 -right-1 w-2 cursor-ew-resize hover:bg-amber-400/20 flex items-center justify-center"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const container = textOverlayRef.current;
                                    if (!container) return;
                                    const containerRect = container.getBoundingClientRect();
                                    const startX = e.clientX;
                                    const startWidth = containerWidth;
                                    const onMove = (ev: MouseEvent) => {
                                      const deltaPx = ev.clientX - startX;
                                      const deltaFrac = (deltaPx / containerRect.width) * 2;
                                      const newW = Math.max(0.1, Math.min(1.0, startWidth + deltaFrac));
                                      updateTextItemLocal(item.id, { width: Math.round(newW * 100) / 100 });
                                    };
                                    const onUp = (ev: MouseEvent) => {
                                      window.removeEventListener("mousemove", onMove);
                                      window.removeEventListener("mouseup", onUp);
                                      const deltaPx = ev.clientX - startX;
                                      const deltaFrac = (deltaPx / containerRect.width) * 2;
                                      const newW = Math.max(0.1, Math.min(1.0, startWidth + deltaFrac));
                                      handleUpdateText(item.id, { width: Math.round(newW * 100) / 100 });
                                    };
                                    window.addEventListener("mousemove", onMove);
                                    window.addEventListener("mouseup", onUp);
                                  }}
                                >
                                  <div className="w-0.5 h-6 bg-amber-400 rounded-full" />
                                </div>
                                {/* Corner dots (visual only, no resize) */}
                                <div className="absolute -top-1 -left-1 w-2 h-2 bg-amber-400 rounded-full pointer-events-none" />
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full pointer-events-none" />
                                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-amber-400 rounded-full pointer-events-none" />
                                <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-amber-400 rounded-full pointer-events-none" />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedElement?.type === "full-video" || selectedElement?.type === "text" ? null : selectedElement?.type === "transition" ? (
                  <div className="w-[min(60vh*9/16,400px)]">
                    <TransitionPreview
                      fromSceneId={selectedElement.fromSceneId}
                      toSceneId={selectedElement.toSceneId}
                      transitionClips={parsedTransitionClips ?? {}}
                      speed={selectedTransition?.speed ?? 1.0}
                    />
                  </div>
                ) : (
                  <div className="w-[min(60vh*9/16,400px)]">
                    <ScenePreview
                      scene={selectedScene}
                      mode={previewMode}
                      onModeChange={setPreviewMode}
                      videoTimeRef={videoTimeRef}
                    />
                    {/* Progress bar for active generation */}
                    {selectedScene && clipJobs[selectedScene.id] && (
                      <div className="mt-3 space-y-2">
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

            {/* Prev / Next navigation — scenes + transitions interleaved (hidden for full-video) */}
            {selectedElement && selectedElement.type !== "full-video" && (
              <div className="flex-shrink-0 py-3 flex items-center justify-center gap-4 border-t border-slate-800/50">
                {(() => {
                  // Build ordered segment list: scene, transition, scene, transition, ...
                  type Segment = { type: "scene"; id: string } | { type: "transition"; fromSceneId: number; toSceneId: number };
                  const segments: Segment[] = [];
                  for (let i = 0; i < scenes.length; i++) {
                    segments.push({ type: "scene", id: scenes[i].id });
                    if (i < scenes.length - 1) {
                      const sNum = scenes[i].scene_id ?? i + 1;
                      const nNum = scenes[i + 1].scene_id ?? i + 2;
                      const hasTrans = transitions.some((t) => t.from_scene_id === sNum && t.to_scene_id === nNum);
                      if (hasTrans) {
                        segments.push({ type: "transition", fromSceneId: sNum, toSceneId: nNum });
                      }
                    }
                  }

                  const currentIdx = selectedElement.type === "scene"
                    ? segments.findIndex((s) => s.type === "scene" && s.id === selectedElement.id)
                    : selectedElement.type === "transition"
                    ? segments.findIndex((s) => s.type === "transition" && s.fromSceneId === selectedElement.fromSceneId && s.toSceneId === selectedElement.toSceneId)
                    : -1;

                  const goTo = (seg: Segment) => {
                    if (seg.type === "scene") {
                      selectScene(seg.id);
                      setActiveRightTab("clip");
                    } else {
                      handleSelectTransition(seg.fromSceneId, seg.toSceneId);
                    }
                  };

                  return (
                    <>
                      {currentIdx > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-slate-400"
                          onClick={() => goTo(segments[currentIdx - 1])}
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Prev
                        </Button>
                      )}
                      <span className="text-[10px] text-slate-600">
                        {currentIdx + 1} / {segments.length}
                      </span>
                      {currentIdx < segments.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-slate-400"
                          onClick={() => goTo(segments[currentIdx + 1])}
                        >
                          Next
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        }

        /* ============================================================ */
        /*  RIGHT PANEL — Clip / Keyframe / Properties                   */
        /* ============================================================ */
        rightPanel={
          selectedElement?.type === "full-video" || selectedElement?.type === "text" ? (
            <div className="flex flex-col h-full">
              {/* Tab bar */}
              <div className="flex border-b border-slate-800/50 flex-shrink-0">
                {([
                  { key: "output" as const, label: "Output", icon: Clapperboard },
                  { key: "color" as const, label: "Color", icon: Palette },
                  { key: "text" as const, label: "Text", icon: Type },
                  { key: "audio" as const, label: "Audio", icon: Volume2 },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFullVideoTab(tab.key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition-colors whitespace-nowrap border-b-2",
                      fullVideoTab === tab.key
                        ? "text-amber-400 border-amber-500 bg-amber-500/5"
                        : "text-slate-400 border-transparent hover:text-slate-300 hover:bg-slate-900/50"
                    )}
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-4">
                {fullVideoTab === "output" && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Render Options</p>

                      {([
                        { key: "text_overlays", label: "Text Overlays" },
                        { key: "color_grade", label: "Color Grading" },
                        { key: "audio", label: "Audio" },
                      ] as const).map((opt) => (
                        <label key={opt.key} className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-slate-300">{opt.label}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={renderOpts[opt.key] ?? true}
                            onClick={() => setRenderOpts((o) => ({ ...o, [opt.key]: !(o[opt.key] ?? true) }))}
                            className={cn(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                              (renderOpts[opt.key] ?? true) ? "bg-amber-500" : "bg-slate-700"
                            )}
                          >
                            <span className={cn(
                              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                              (renderOpts[opt.key] ?? true) ? "translate-x-4" : "translate-x-1"
                            )} />
                          </button>
                        </label>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/50">
                      <Button
                        size="sm"
                        onClick={handleRender}
                        disabled={isRendering || scenes.length === 0}
                        className="gap-2 w-full"
                      >
                        {isRendering ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Clapperboard className="w-4 h-4" />
                        )}
                        {isRendering ? "Rendering..." : "Render Video"}
                      </Button>

                      {project.output_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDownload}
                          disabled={isPublishing}
                          className="gap-2 w-full"
                        >
                          <Download className="w-4 h-4" />
                          {isPublishing ? "Downloading..." : "Download"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {fullVideoTab === "color" && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-slate-300">Color Grading</span>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Presets</p>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          { label: "Neutral", values: { temperature: 6500, saturation: 1.0, contrast: 1.0, vignette: 0 } },
                          { label: "Roman", values: { temperature: 6500, saturation: 1.05, contrast: 1.1, vignette: 0.3 } },
                          { label: "Greek", values: { temperature: 6000, saturation: 1.0, contrast: 1.15, vignette: 0.15 } },
                          { label: "Chinese", values: { temperature: 5500, saturation: 0.85, contrast: 1.0, vignette: 0.2 } },
                          { label: "Japanese", values: { temperature: 5800, saturation: 0.8, contrast: 0.95, vignette: 0.1 } },
                        ] as const).map((preset) => {
                          const isActive = colorGrade.temperature === preset.values.temperature
                            && colorGrade.saturation === preset.values.saturation
                            && colorGrade.contrast === preset.values.contrast
                            && colorGrade.vignette === preset.values.vignette;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                setColorGrade(preset.values);
                                if (colorGradeEffectId) {
                                  updateProjectEffect(id, colorGradeEffectId, { settings_json: JSON.stringify(preset.values) }).catch(() => {});
                                }
                              }}
                              className={cn(
                                "px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors",
                                isActive
                                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                                  : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                              )}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Temperature */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Temperature</span>
                          <span className="text-xs font-mono text-amber-400">{colorGrade.temperature}K</span>
                        </div>
                        <Slider
                          min={3000}
                          max={9000}
                          step={100}
                          value={colorGrade.temperature}
                          onChange={(v) => handleColorGradeChange("temperature", v)}
                        />
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>3000K</span>
                          <span>9000K</span>
                        </div>
                      </div>

                      {/* Saturation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Saturation</span>
                          <span className="text-xs font-mono text-amber-400">{colorGrade.saturation.toFixed(2)}</span>
                        </div>
                        <Slider
                          min={0}
                          max={2}
                          step={0.05}
                          value={colorGrade.saturation}
                          onChange={(v) => handleColorGradeChange("saturation", v)}
                        />
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>0</span>
                          <span>2.0</span>
                        </div>
                      </div>

                      {/* Contrast */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Contrast</span>
                          <span className="text-xs font-mono text-amber-400">{colorGrade.contrast.toFixed(2)}</span>
                        </div>
                        <Slider
                          min={0}
                          max={2}
                          step={0.05}
                          value={colorGrade.contrast}
                          onChange={(v) => handleColorGradeChange("contrast", v)}
                        />
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>0</span>
                          <span>2.0</span>
                        </div>
                      </div>

                      {/* Vignette */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Vignette</span>
                          <span className="text-xs font-mono text-amber-400">{colorGrade.vignette.toFixed(2)}</span>
                        </div>
                        <Slider
                          min={0}
                          max={1}
                          step={0.05}
                          value={colorGrade.vignette}
                          onChange={(v) => handleColorGradeChange("vignette", v)}
                        />
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>0</span>
                          <span>1.0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {fullVideoTab === "text" && (
                  selectedElement?.type === "text" && selectedTextItem ? (
                    /* Editing a specific text item — show editor with back button */
                    <div>
                      <button
                        onClick={() => selectElement({ type: "full-video" })}
                        className="flex items-center gap-1 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <ChevronLeft className="w-3 h-3" /> Back to all text
                      </button>
                      <TextItemEditor
                        item={selectedTextItem}
                        onUpdate={(updates) => handleUpdateText(selectedTextItem.id, updates)}
                      />
                    </div>
                  ) : (
                    /* Text list — add, select, bulk edit */
                    <div className="p-4 space-y-3">
                      <button
                        onClick={handleAddText}
                        className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold flex items-center justify-center gap-2"
                      >
                        <Type className="w-4 h-4" /> Add Text Overlay
                      </button>

                      {textItems.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-sm">
                          No text overlays yet
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {textItems.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => selectElement({ type: "text", id: item.id })}
                              className="rounded-lg border border-slate-800 hover:border-slate-700 p-3 cursor-pointer"
                            >
                              <p className="text-sm text-white truncate">{item.text || "Empty text"}</p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                {(item.from_frame / 30).toFixed(1)}s — {((item.from_frame + item.duration_frames) / 30).toFixed(1)}s
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {textItems.length > 1 && (
                        <button
                          onClick={() => {
                            const style = textItems[0];
                            textItems.slice(1).forEach((t) => {
                              handleUpdateText(t.id, {
                                font_family: style.font_family,
                                font_size: style.font_size,
                                color: style.color,
                              });
                            });
                          }}
                          className="w-full py-1.5 rounded border border-slate-700 text-slate-400 text-xs hover:text-slate-300 hover:border-slate-600"
                        >
                          Apply first item&apos;s style to all
                        </button>
                      )}
                    </div>
                  )
                )}

                {fullVideoTab === "audio" && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-slate-300">Audio</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Volume</span>
                        <span className="text-xs font-mono text-amber-400">{audioVolume}%</span>
                      </div>
                      <Slider
                        min={0}
                        max={200}
                        step={5}
                        value={audioVolume}
                        onChange={setAudioVolume}
                      />
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>0%</span>
                        <span>200%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div className="flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex border-b border-slate-800/50 flex-shrink-0">
              {(selectedElement?.type === "transition" ? [
                { key: "clip" as const, label: "Transition", icon: Film },
              ] : [
                { key: "clip" as const, label: "Clip", icon: Play },
                { key: "keyframe" as const, label: "Keyframe", icon: ImageIcon },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveRightTab(tab.key);
                    if (tab.key === "clip") setPreviewMode("clip");
                    else if (tab.key === "keyframe") setPreviewMode("keyframe");
                  }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium transition-colors whitespace-nowrap border-b-2",
                    activeRightTab === tab.key
                      ? "text-amber-400 border-amber-500 bg-amber-500/5"
                      : "text-slate-400 border-transparent hover:text-slate-300 hover:bg-slate-900/50"
                  )}
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto min-h-0 p-3">
              {activeRightTab === "clip" && selectedElement?.type === "transition" ? (
                /* ---- TRANSITION ACTIONS ---- */
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                    Transition {selectedElement.fromSceneId} → {selectedElement.toSceneId}
                  </p>
                  {(() => {
                    const tKey = `${selectedElement.fromSceneId}_${selectedElement.toSceneId}`;
                    const tClips = parsedTransitionClips ?? {};
                    const tClip = tClips[tKey];
                    return tClip?.clip_path ? (
                      <>
                        <a
                          href={clipUrl(`/files/${tClip.clip_path}`)}
                          download={`transition_${selectedElement.fromSceneId}_${selectedElement.toSceneId}.mp4`}
                          className="w-full"
                        >
                          <Button variant="secondary" size="sm" className="gap-2 w-full">
                            <Download className="w-4 h-4" />
                            Download
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 w-full"
                          onClick={() => {
                            const trans = transitions.find(
                              (t) => t.from_scene_id === selectedElement.fromSceneId && t.to_scene_id === selectedElement.toSceneId
                            );
                            if (trans) {
                              handleGenerateTransition(selectedElement.fromSceneId, selectedElement.toSceneId, trans.prompt);
                            }
                          }}
                          disabled={generatingTransition}
                        >
                          {generatingTransition ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          {generatingTransition ? "Generating..." : "Regenerate"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-2 w-full"
                        onClick={() => {
                          const trans = transitions.find(
                            (t) => t.from_scene_id === selectedElement.fromSceneId && t.to_scene_id === selectedElement.toSceneId
                          );
                          handleGenerateTransition(selectedElement.fromSceneId, selectedElement.toSceneId, trans?.prompt);
                        }}
                        disabled={generatingTransition}
                      >
                        {generatingTransition ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Generate Transition
                      </Button>
                    );
                  })()}
                  {/* Properties inline */}
                  <div className="mt-4 pt-4 border-t border-slate-800/50">
                    <TransitionDetail
                      transition={selectedTransition ?? {
                        id: "",
                        from_scene_id: selectedElement.fromSceneId,
                        to_scene_id: selectedElement.toSceneId,
                        transition_type: "ai_morph",
                        type: "ai_morph",
                        prompt: "",
                        duration: 3.0,
                        from_frame: 0,
                        duration_frames: 90,
                        speed: 1.5,
                        in_offset: 0,
                        out_offset: 0,
                      }}
                      onUpdate={handleUpdateTransition}
                    />
                  </div>
                </div>
              ) : activeRightTab === "clip" && selectedScene ? (
                /* ---- CLIP ACTIONS ---- */
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                    Scene {selectedScene.scene_id ?? selectedScene.id}
                  </p>
                  {clipJobs[selectedScene.id] ? (
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
                  ) : selectedScene.clip_url ? (
                    <>
                      <a
                        href={clipUrl(selectedScene.clip_url)}
                        download={`scene_${selectedScene.scene_id ?? selectedScene.id}.mp4`}
                        className="w-full"
                      >
                        <Button variant="secondary" size="sm" className="gap-2 w-full">
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 w-full"
                        onClick={() => handleRegenerateClip(selectedScene.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        {isGenerating ? "Generating..." : "Regenerate Clip"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 w-full"
                        onClick={handleExtractFrame}
                        disabled={extractingFrame}
                      >
                        <Scissors className="w-4 h-4" />
                        {extractingFrame ? "Extracting..." : "Extract Frame"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="gap-2 w-full"
                        onClick={() => handleRegenerateClip(selectedScene.id)}
                        disabled={isGenerating}
                      >
                        <Film className="w-4 h-4" />
                        Generate Clip
                      </Button>
                      {!selectedScene.keyframe_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 w-full text-slate-400"
                          onClick={() => { setPreviewMode("keyframe"); setActiveRightTab("keyframe"); }}
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate Keyframe First
                        </Button>
                      )}
                    </>
                  )}
                  {/* Properties inline */}
                  <div className="mt-4 pt-4 border-t border-slate-800/50">
                    <SceneDetail
                      scene={selectedScene}
                      characters={project ? [{
                        name: project.character_name || project.name?.split("—")[0]?.trim() || project.character_id || "Character",
                        imageUrl: project.character_image_url ? clipUrl(project.character_image_url) : null,
                      }] : undefined}
                      onUpdate={handleUpdateScene}
                      onRegenerate={handleRegenerateClip}
                      isGenerating={isGenerating}
                    />
                  </div>
                </div>
              ) : activeRightTab === "keyframe" && selectedScene ? (
                /* ---- KEYFRAME ACTIONS ---- */
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                    Scene {selectedScene.scene_id ?? selectedScene.id}
                  </p>
                  {clipJobs[selectedScene.id] ? (
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
                  ) : (
                    <>
                      {selectedScene.keyframe_url ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2 w-full"
                            onClick={() => handleRegenerateClip(selectedScene.id)}
                            disabled={isGenerating}
                          >
                            <Film className="w-4 h-4" />
                            Generate Clip
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 w-full"
                            onClick={() => handleGenerateKeyframe(selectedScene.id, selectedScene.scene_id ?? Number(selectedScene.id))}
                            disabled={isGenerating}
                          >
                            <Sparkles className="w-4 h-4" />
                            Regenerate Keyframe
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2 w-full"
                            onClick={() => handleGenerateKeyframe(selectedScene.id, selectedScene.scene_id ?? Number(selectedScene.id))}
                            disabled={isGenerating}
                          >
                            <Sparkles className="w-4 h-4" />
                            Generate Keyframe
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 w-full text-slate-400"
                            onClick={() => handleRegenerateClip(selectedScene.id)}
                            disabled={isGenerating}
                          >
                            <Film className="w-4 h-4" />
                            Skip to Clip
                          </Button>
                        </>
                      )}

                      {/* Character in Scene toggle */}
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/40 border border-slate-700/50 mt-2">
                        <div>
                          <p className="text-xs text-slate-300 font-medium">Character in Scene</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {selectedScene.character_present
                              ? "Portrait composited into keyframe"
                              : "Environment only"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateScene(selectedScene.id, { character_present: !selectedScene.character_present })}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                            selectedScene.character_present ? "bg-amber-500" : "bg-slate-600"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                              selectedScene.character_present ? "translate-x-4.5" : "translate-x-0.5"
                            )}
                          />
                        </button>
                      </div>

                      {/* Ref images, Start/End Keyframe pickers */}
                      <div className="w-full mt-2 pt-3 border-t border-slate-800/50 space-y-3">
                        {/* Reference Images — above start keyframe */}
                        {(() => {
                          const sceneRefs = selectedScene.reference_images ?? [];
                          // Only the generated character portrait (not source ref photos)
                          const charImages: string[] = [];
                          if (selectedScene.character_present && project.character_image_url) {
                            charImages.push(clipUrl(project.character_image_url));
                          }
                          const totalRefs = charImages.length + sceneRefs.length;
                          return (
                            <div className="relative">
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Reference Images</p>
                              <div className="flex gap-1.5 flex-wrap">
                                {/* Locked character images (when character_present) */}
                                {charImages.map((url, i) => (
                                  <div key={`char-${i}`} className="relative">
                                    <img
                                      src={url.startsWith("http") ? url : clipUrl(url)}
                                      alt="Character"
                                      className="w-10 h-14 rounded border border-amber-500/50 object-cover ring-1 ring-amber-500/20"
                                    />
                                    <span className="absolute bottom-0 inset-x-0 bg-amber-500/80 text-[7px] text-center text-white font-medium py-px rounded-b">
                                      char
                                    </span>
                                  </div>
                                ))}
                                {/* User-selected refs */}
                                {sceneRefs.map((url, i) => (
                                  <div key={i} className="relative group/ref">
                                    <img
                                      src={url.startsWith("http") ? url : clipUrl(url)}
                                      alt={`Ref ${i + 1}`}
                                      className="w-10 h-14 rounded border border-slate-700 object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSetReferenceImages(sceneRefs.filter((_, j) => j !== i))}
                                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center opacity-0 group-hover/ref:opacity-100 transition-opacity cursor-pointer"
                                    >
                                      <X className="w-2.5 h-2.5 text-slate-400" />
                                    </button>
                                  </div>
                                ))}
                                {totalRefs < 5 && (
                                  <button
                                    type="button"
                                    onClick={() => setRefImagePicker(true)}
                                    className="w-10 h-14 rounded border-2 border-dashed border-slate-700 hover:border-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-4 h-4 text-slate-600" />
                                  </button>
                                )}
                              </div>
                              {refImagePicker && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setRefImagePicker(false)} />
                                  <div className="absolute left-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl w-72 max-h-80 overflow-y-auto">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Select reference image</p>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {pickerImages
                                        .filter((img) => !sceneRefs.includes(img.url))
                                        .map((img, idx) => (
                                        <button
                                          key={`ref-${idx}`}
                                          type="button"
                                          onClick={() => {
                                            handleSetReferenceImages([...sceneRefs, img.url]);
                                            if (sceneRefs.length + 1 >= 5) setRefImagePicker(false);
                                          }}
                                          className="rounded border border-slate-700 hover:border-amber-500 overflow-hidden transition-colors cursor-pointer"
                                        >
                                          <img src={clipUrl(img.url)} alt={img.label} className="w-full aspect-[9/16] object-cover" />
                                          <span className="text-[8px] text-slate-400 block px-1 py-0.5 truncate">{img.label}</span>
                                        </button>
                                      ))}
                                    </div>
                                    {pickerImages.filter((img) => !sceneRefs.includes(img.url)).length === 0 && (
                                      <p className="text-[10px] text-slate-500 text-center py-4">No images available</p>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })()}

                        {/* Start Keyframe */}
                        <div className="relative">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Start Keyframe</p>
                          {(selectedScene.keyframe_path || selectedScene.keyframe_url) ? (
                            <div className="relative group/skf inline-block">
                              <img
                                src={selectedScene.keyframe_path ? clipUrl(`/files/${selectedScene.keyframe_path}`) : selectedScene.keyframe_url!}
                                alt="Start keyframe"
                                className="w-10 h-14 rounded border border-slate-700 object-cover cursor-pointer"
                                onClick={() => setStartKeyframePicker(true)}
                              />
                              <button
                                type="button"
                                onClick={() => setStartKeyframePicker(true)}
                                className="absolute inset-0 rounded bg-black/40 opacity-0 group-hover/skf:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setStartKeyframePicker(true)}
                              className="w-10 h-14 rounded border-2 border-dashed border-slate-700 hover:border-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4 text-slate-600" />
                            </button>
                          )}
                          {startKeyframePicker && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setStartKeyframePicker(false)} />
                              <div className="absolute left-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl w-72 max-h-80 overflow-y-auto">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Select start keyframe</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {pickerImages.map((img, idx) => (
                                    <button
                                      key={`spk-${idx}`}
                                      type="button"
                                      onClick={() => { handleSetStartKeyframe(img.url, img.path); setStartKeyframePicker(false); }}
                                      className="rounded border border-slate-700 hover:border-amber-500 overflow-hidden transition-colors cursor-pointer"
                                    >
                                      <img src={clipUrl(img.url)} alt={img.label} className="w-full aspect-[9/16] object-cover" />
                                      <span className="text-[8px] text-slate-400 block px-1 py-0.5 truncate">{img.label}</span>
                                    </button>
                                  ))}
                                </div>
                                {pickerImages.length === 0 && (
                                  <p className="text-[10px] text-slate-500 text-center py-4">No keyframes or frames available</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* End Keyframe */}
                        <div className="relative">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">End Keyframe</p>
                          {selectedScene.end_keyframe_url ? (
                            <div className="relative group/ekf inline-block">
                              <img
                                src={clipUrl(selectedScene.end_keyframe_url!)}
                                alt="End keyframe"
                                className="w-10 h-14 rounded border border-slate-700 object-cover cursor-pointer"
                                onClick={() => setEndKeyframePicker(true)}
                              />
                              <button
                                type="button"
                                onClick={() => setEndKeyframePicker(true)}
                                className="absolute inset-0 rounded bg-black/40 opacity-0 group-hover/ekf:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3 text-white" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetEndKeyframe(null)}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center opacity-0 group-hover/ekf:opacity-100 transition-opacity cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5 text-slate-400" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEndKeyframePicker(true)}
                              className="w-10 h-14 rounded border-2 border-dashed border-slate-700 hover:border-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4 text-slate-600" />
                            </button>
                          )}
                          {endKeyframePicker && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setEndKeyframePicker(false)} />
                              <div className="absolute left-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl w-72 max-h-80 overflow-y-auto">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Select end keyframe</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {pickerImages.map((img, idx) => (
                                    <button
                                      key={`epk-${idx}`}
                                      type="button"
                                      onClick={() => { handleSetEndKeyframe(img.url); setEndKeyframePicker(false); }}
                                      className="rounded border border-slate-700 hover:border-amber-500 overflow-hidden transition-colors cursor-pointer"
                                    >
                                      <img src={clipUrl(img.url)} alt={img.label} className="w-full aspect-[9/16] object-cover" />
                                      <span className="text-[8px] text-slate-400 block px-1 py-0.5 truncate">{img.label}</span>
                                    </button>
                                  ))}
                                </div>
                                {pickerImages.length === 0 && (
                                  <p className="text-[10px] text-slate-500 text-center py-4">No keyframes available yet</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                  Select a scene or transition
                </div>
              )}
            </div>
          </div>
          )
        }

        /* ============================================================ */
        /*  TIMELINE                                                      */
        /* ============================================================ */
        timeline={
          <EditorTimeline
            scenes={scenes}
            transitions={transitions}
            selectedSceneId={selectedSceneId}
            selectedTransition={selectedElement?.type === "transition" ? selectedElement : null}
            onSelectScene={handleSelectScene}
            onSelectTransition={handleSelectTransition}
            audioMode={project.audio_mode}
            audioFilename={project.uploaded_audio_path}
            audioDuration={audioDuration}
            playbackProgress={playbackProgress}
            onPlayheadSeek={selectedElement?.type === "full-video" ? (fraction) => videoPreviewRef.current?.seekToFraction(fraction) : undefined}
            actualSegments={actualSegments}
            actualTotalDuration={actualTotalDuration}
            onUpdateScene={handleUpdateScene}
            onUpdateTransition={handleUpdateTransition}
            colorGradeEnabled={renderOpts.color_grade ?? true}
            textItems={textItems}
            selectedTextId={selectedElement?.type === "text" ? selectedElement.id : null}
            onSelectText={(textId) => selectElement({ type: "text", id: textId })}
            onUpdateTextItem={handleUpdateText}
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

      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title={`Delete Scene ${deleteConfirm?.sceneNum ?? ""}?`}
        description="This cannot be undone. The scene and its generated clips will be removed."
        confirmLabel="Delete Scene"
        variant="danger"
        onConfirm={confirmDeleteScene}
      />

      <ConfirmDialog
        open={transitionDeleteConfirm !== null}
        onOpenChange={(open) => { if (!open) setTransitionDeleteConfirm(null); }}
        title={`Remove Transition ${transitionDeleteConfirm?.from ?? ""} → ${transitionDeleteConfirm?.to ?? ""}?`}
        description="The transition between these scenes will be removed."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmDeleteTransition}
      />
    </>
  );
}
