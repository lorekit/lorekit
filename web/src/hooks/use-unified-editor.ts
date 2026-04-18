"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useWorkflowStore } from "@/stores/workflow-store";
import {
  getProject,
  getScenes,
  getWorkflow,
  createWorkflow,
  updateWorkflowFull,
  executeWorkflow,
  updateScene as updateSceneAPI,
  updateTransition as updateTransitionAPI,
  generateClip,
  generateClips,
  generateKeyframe,
  generateCharacterImage,
  generateTransition,
  renderProject,
  downloadProjectFile,
  extractFrame,
  setStartKeyframe,
  setEndKeyframe,
  setReferenceImages,
  addTextItem,
  updateTextItem,
  deleteTextItem,
  deleteScene,
  deleteTransition,
  getJob,
  clipUrl,
  getCharacterReferenceImages,
  getCharacterImages,
  getProjectEffects,
  createProjectEffect,
  updateProjectEffect,
  getUniverseEnvironments,
  getProjectRenders,
  deleteProjectRender,
  API_BASE,
} from "@/lib/api";
import type {
  Scene,
  Transition,
  TextItem,
  CharacterImageEntry,
  RenderOptions,
  RenderRecord,
  Workflow,
  WorkflowNode,
} from "@/lib/api";

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
    if (onProgress) onProgress(job.progress, job.message);
    if (job.status === "completed") return job.result;
    if (job.status === "failed") throw new Error(job.message || "Job failed");
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
  throw new Error("Job timed out");
}

// ---------------------------------------------------------------------------
// Per-scene clip progress tracker
// ---------------------------------------------------------------------------

export interface ClipJobState {
  sceneId: string;
  progress: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUnifiedEditor(projectId: string, universeId: string) {
  // --- Project store ---
  const project = useProjectStore((s) => s.project);
  const scenes = useProjectStore((s) => s.scenes);
  const transitions = useProjectStore((s) => s.transitions);
  const textItems = useProjectStore((s) => s.textItems);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectedElement = useProjectStore((s) => s.selectedElement);
  const isLoading = useProjectStore((s) => s.isLoading);
  const isGenerating = useProjectStore((s) => s.isGenerating);
  const setProject = useProjectStore((s) => s.setProject);
  const setScenes = useProjectStore((s) => s.setScenes);
  const setTransitions = useProjectStore((s) => s.setTransitions);
  const setTextItems = useProjectStore((s) => s.setTextItems);
  const selectScene = useProjectStore((s) => s.selectScene);
  const selectElement = useProjectStore((s) => s.selectElement);
  const updateSceneInStore = useProjectStore((s) => s.updateScene);
  const updateTransitionInStore = useProjectStore((s) => s.updateTransition);
  const selectedSceneFn = useProjectStore((s) => s.selectedScene);
  const selectedTransitionFn = useProjectStore((s) => s.selectedTransition);
  const totalDurationFn = useProjectStore((s) => s.totalDuration);
  const setLoading = useProjectStore((s) => s.setLoading);
  const setGenerating = useProjectStore((s) => s.setGenerating);
  const resetProjectStore = useProjectStore((s) => s.reset);
  const addTextItemLocal = useProjectStore((s) => s.addTextItemLocal);
  const updateTextItemLocal = useProjectStore((s) => s.updateTextItemLocal);
  const removeTextItemLocal = useProjectStore((s) => s.removeTextItemLocal);

  // --- Workflow store ---
  const workflow = useWorkflowStore((s) => s.workflow);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode);
  const updateNodeParams = useWorkflowStore((s) => s.updateNodeParams);

  // --- Local state ---
  const [error, setError] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [needsStory, setNeedsStory] = useState(false);
  const [clipJobs, setClipJobs] = useState<Record<string, ClipJobState>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [allClipsProgress, setAllClipsProgress] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generatingCharacter, setGeneratingCharacter] = useState(false);
  const [generatingTransition, setGeneratingTransition] = useState(false);
  const [extractingFrame, setExtractingFrame] = useState(false);
  const [characterRefUrls, setCharacterRefUrls] = useState<string[]>([]);
  const [characterImages, setCharacterImages] = useState<CharacterImageEntry[]>([]);
  const [renderOpts, setRenderOpts] = useState<RenderOptions>({
    text_overlays: true,
    color_grade: true,
    audio: true,
  });
  const [colorGrade, setColorGrade] = useState({
    temperature: 6500,
    saturation: 1.05,
    contrast: 1.1,
    vignette: 0.3,
  });
  const [colorGradeEffectId, setColorGradeEffectId] = useState<string | null>(null);
  const [renders, setRenders] = useState<RenderRecord[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);

  const videoTimeRef = useRef(0);

  // --- Derived ---
  const selectedScene = selectedSceneFn();
  const selectedTransition = selectedTransitionFn();
  const totalDuration = totalDurationFn();
  const clipsGenerated = scenes.filter((s) => s.clip_url || s.clip_path).length;
  const allClipsDone = scenes.length > 0 && clipsGenerated === scenes.length;

  // Selected workflow node
  const selectedNode = useMemo(() => {
    if (!workflow || !selectedNodeId) return null;
    return workflow.nodes[selectedNodeId] ?? null;
  }, [workflow, selectedNodeId]);

  // Transition clips map
  const parsedTransitionClips = useMemo(() => {
    if (!transitions || transitions.length === 0) return undefined;
    const map: Record<string, { clip_path?: string; clip_url?: string }> = {};
    for (const t of transitions) {
      if (t.clip_path) {
        map[`${t.from_scene_id}_${t.to_scene_id}`] = {
          clip_path: t.clip_path,
          clip_url: t.clip_url ?? undefined,
        };
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [transitions]);

  // Available keyframe images for pickers
  const pickerImages = useMemo(() => {
    const images: Array<{ url: string; path: string | null; label: string }> = [];
    const seen = new Set<string>();
    for (const s of scenes) {
      const displayUrl = s.keyframe_path ? `/files/${s.keyframe_path}` : s.keyframe_url;
      if (displayUrl && !seen.has(displayUrl)) {
        seen.add(displayUrl);
        images.push({ url: displayUrl, path: s.keyframe_path ?? null, label: `Scene ${s.scene_id ?? "?"}` });
      }
      for (const h of s.keyframe_history ?? []) {
        const hUrl = h.path ? `/files/${h.path}` : h.url;
        if (hUrl && !seen.has(hUrl)) {
          seen.add(hUrl);
          images.push({ url: hUrl, path: h.path ?? null, label: `Scene ${s.scene_id ?? "?"}` });
        }
      }
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

  // ---------- Load everything on mount ----------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setWorkflowLoading(true);
      setError(null);

      try {
        // Load project + scenes in parallel
        const [proj, scenesData] = await Promise.all([
          getProject(projectId),
          getScenes(projectId),
        ]);

        if (cancelled) return;

        setProject(proj);
        setScenes(scenesData.scenes);
        setTransitions(scenesData.transitions);
        setTextItems(scenesData.text_items ?? []);

        // Load workflow — auto-create if missing or stale
        let existingWf: Workflow | null = null;
        try {
          existingWf = await getWorkflow(projectId);
        } catch {
          // No workflow exists
        }

        const hasScenes = scenesData.scenes.length > 0;

        if (existingWf) {
          if (!cancelled) setWorkflow(existingWf);
        } else if (hasScenes) {
          try {
            const wf = await createWorkflow({ project_id: projectId });
            if (!cancelled) {
              setWorkflow(wf);
              // Re-fetch scenes — backend wrote clip_node_id/keyframe_node_id during creation
              const updated = await getScenes(projectId);
              setScenes(updated.scenes);
              setTransitions(updated.transitions);
            }
          } catch (err) {
            console.error("Auto-create workflow failed:", err);
          }
        } else {
          if (!cancelled) setNeedsStory(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load project");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setWorkflowLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      resetProjectStore();
      setWorkflow(null);
    };
  }, [projectId]);

  // Load character reference images
  useEffect(() => {
    if (!project?.character_id) return;
    getCharacterReferenceImages(project.character_id)
      .then((data) => setCharacterRefUrls(data.urls))
      .catch(() => {});
    // Load all character images for the media gallery
    getCharacterImages(project.character_id)
      .then((data) => {
        const allImages: CharacterImageEntry[] = [];
        for (const theme of data.themes) {
          for (const img of theme.images) {
            allImages.push(img);
          }
        }
        setCharacterImages(allImages);
      })
      .catch(() => {});
  }, [project?.character_id]);

  // Load color grade effect
  useEffect(() => {
    if (!projectId) return;
    getProjectEffects(projectId)
      .then(async (effects) => {
        const existing = effects.find((e) => e.effect_type === "color_grade");
        if (!existing) {
          let defaults = { temperature: 6500, saturation: 1.05, contrast: 1.1, vignette: 0.3 };
          if (universeId) {
            try {
              const envs = await getUniverseEnvironments(universeId);
              if (envs.length > 0 && envs[0].color_grade_json) {
                defaults = { ...defaults, ...JSON.parse(envs[0].color_grade_json) };
              }
            } catch {}
          }
          const created = await createProjectEffect(projectId, {
            effect_type: "color_grade",
            name: "Color Grade",
            settings_json: JSON.stringify(defaults),
          });
          setColorGrade(defaults);
          setColorGradeEffectId(created.id);
        } else {
          try {
            setColorGrade((prev) => ({ ...prev, ...JSON.parse(existing.settings_json) }));
          } catch {}
          setColorGradeEffectId(existing.id);
        }
      })
      .catch(() => {});
  }, [projectId, universeId]);

  // Fetch render history
  useEffect(() => {
    if (!projectId) return;
    getProjectRenders(projectId).then((data) => setRenders(data.renders)).catch(() => {});
  }, [projectId]);

  // Load audio duration
  useEffect(() => {
    if (!project?.uploaded_audio_path) { setAudioDuration(0); return; }
    const audio = new Audio(clipUrl(`/files/${project.uploaded_audio_path}`));
    audio.onloadedmetadata = () => setAudioDuration(audio.duration);
    audio.onerror = () => setAudioDuration(0);
  }, [project?.uploaded_audio_path]);

  // ---------- Refresh helper ----------
  const refreshProject = useCallback(async () => {
    try {
      const [proj, scenesData] = await Promise.all([
        getProject(projectId),
        getScenes(projectId),
      ]);
      setProject(proj);
      setScenes(scenesData.scenes);
      setTransitions(scenesData.transitions);
      setTextItems(scenesData.text_items ?? []);

      // Also refresh workflow
      try {
        const wf = await getWorkflow(projectId);
        setWorkflow(wf);
      } catch {}
    } catch {}
  }, [projectId, setProject, setScenes, setTransitions, setTextItems, setWorkflow]);

  // ---------- Scene update handler ----------
  const handleUpdateScene = useCallback(
    async (sceneId: string, updates: Partial<Scene>) => {
      updateSceneInStore(sceneId, updates);
      try {
        await updateSceneAPI(projectId, sceneId, updates);
      } catch {
        const scenesData = await getScenes(projectId);
        setScenes(scenesData.scenes);
        setTransitions(scenesData.transitions);
        setTextItems(scenesData.text_items ?? []);
      }
    },
    [projectId, updateSceneInStore, setScenes, setTransitions, setTextItems]
  );

  const handleUpdateTransition = useCallback(
    async (fromSceneId: number, toSceneId: number, updates: Partial<Transition>) => {
      updateTransitionInStore(fromSceneId, toSceneId, updates);
      try {
        await updateTransitionAPI(projectId, fromSceneId, toSceneId, updates);
      } catch {
        const scenesData = await getScenes(projectId);
        setScenes(scenesData.scenes);
        setTransitions(scenesData.transitions);
        setTextItems(scenesData.text_items ?? []);
      }
    },
    [projectId, updateTransitionInStore, setScenes, setTransitions, setTextItems]
  );

  // ---------- Generation handlers ----------

  const handleGenerateKeyframe = useCallback(
    async (sceneId: string, sceneNum: number) => {
      setGenerating(true);
      setClipJobs((prev) => ({
        ...prev,
        [sceneId]: { sceneId, progress: 0, message: "Generating keyframe..." },
      }));
      try {
        const scene = scenes.find((s) => s.id === sceneId);
        const refs = scene?.reference_images;
        const { job_id } = await generateKeyframe(projectId, sceneNum, refs?.length ? refs : undefined);
        await pollJob(job_id, (progress, message) => {
          setClipJobs((prev) => ({ ...prev, [sceneId]: { sceneId, progress, message } }));
        });
        await refreshProject();
      } catch (err) {
        console.error("Keyframe generation failed:", err);
      } finally {
        setGenerating(false);
        setClipJobs((prev) => { const next = { ...prev }; delete next[sceneId]; return next; });
      }
    },
    [projectId, scenes, setGenerating, refreshProject]
  );

  const handleRegenerateClip = useCallback(
    async (sceneId: string) => {
      setGenerating(true);
      setClipJobs((prev) => ({
        ...prev,
        [sceneId]: { sceneId, progress: 0, message: "Starting..." },
      }));
      try {
        const { job_id } = await generateClip(projectId, sceneId);
        await pollJob(job_id, (progress, message) => {
          setClipJobs((prev) => ({ ...prev, [sceneId]: { sceneId, progress, message } }));
        });
        await refreshProject();
      } catch (err) {
        console.error("Clip generation failed:", err);
      } finally {
        setGenerating(false);
        setClipJobs((prev) => { const next = { ...prev }; delete next[sceneId]; return next; });
      }
    },
    [projectId, setGenerating, refreshProject]
  );

  const handleGenerateAllClips = useCallback(async () => {
    setGeneratingAll(true);
    setAllClipsProgress("Starting clip generation...");
    try {
      const { job_id } = await generateClips(projectId);
      let lastRefresh = 0;
      await pollJob(job_id, async (_progress, message) => {
        setAllClipsProgress(message || "Generating clips...");
        lastRefresh++;
        if (lastRefresh % 10 === 0) refreshProject();
      });
      await refreshProject();

      // Generate AI transitions
      const freshData = await getScenes(projectId);
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
            const { job_id: transJobId } = await generateTransition(projectId, fromNum, toNum);
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
  }, [projectId, refreshProject, setScenes, setTransitions, setTextItems]);

  const handleGenerateTransition = useCallback(
    async (fromSceneId: number, toSceneId: number, prompt?: string) => {
      setGeneratingTransition(true);
      try {
        const { job_id } = await generateTransition(projectId, fromSceneId, toSceneId, prompt);
        await pollJob(job_id, () => {});
        await refreshProject();
      } catch (err) {
        console.error("Transition generation failed:", err);
      } finally {
        setGeneratingTransition(false);
      }
    },
    [projectId, refreshProject]
  );

  const handleRender = useCallback(async () => {
    if (!project) return;
    setIsRendering(true);
    setRenderProgress("Starting render...");
    try {
      const { job_id } = await renderProject(projectId, renderOpts);
      await pollJob(job_id, (_progress, message) => {
        setRenderProgress(message || "Rendering...");
      });
      await refreshProject();
      getProjectRenders(projectId).then((data) => setRenders(data.renders)).catch(() => {});
    } catch (err) {
      console.error("Render failed:", err);
    } finally {
      setIsRendering(false);
      setRenderProgress(null);
    }
  }, [projectId, project, refreshProject, renderOpts]);

  const handleDownload = useCallback(async () => {
    if (!project) return;
    setIsPublishing(true);
    try {
      const { url } = await downloadProjectFile(projectId, "render");
      const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
      window.open(fullUrl, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsPublishing(false);
    }
  }, [projectId, project]);

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

  const handleExtractFrame = useCallback(async () => {
    if (!selectedScene) return;
    const sceneNum = selectedScene.scene_id ?? Number(selectedScene.id);
    setExtractingFrame(true);
    try {
      await extractFrame(projectId, sceneNum, videoTimeRef.current);
      await refreshProject();
    } catch (err) {
      console.error("Frame extraction failed:", err);
    } finally {
      setExtractingFrame(false);
    }
  }, [projectId, selectedScene, refreshProject]);

  const handleSetStartKeyframe = useCallback(
    async (url: string, path?: string | null) => {
      if (!selectedScene) return;
      const sceneNum = selectedScene.scene_id ?? Number(selectedScene.id);
      try {
        await setStartKeyframe(projectId, sceneNum, url, path ?? null);
        await refreshProject();
      } catch (err) {
        console.error("Failed to set start keyframe:", err);
      }
    },
    [projectId, selectedScene, refreshProject]
  );

  const handleSetEndKeyframe = useCallback(
    async (url: string | null) => {
      if (!selectedScene) return;
      const sceneNum = selectedScene.scene_id ?? Number(selectedScene.id);
      try {
        await setEndKeyframe(projectId, sceneNum, url);
        await refreshProject();
      } catch (err) {
        console.error("Failed to set end keyframe:", err);
      }
    },
    [projectId, selectedScene, refreshProject]
  );

  const handleSetReferenceImages = useCallback(
    async (urls: string[]) => {
      if (!selectedScene) return;
      const sceneNum = selectedScene.scene_id ?? Number(selectedScene.id);
      try {
        await setReferenceImages(projectId, sceneNum, urls);
        await refreshProject();
      } catch (err) {
        console.error("Failed to set reference images:", err);
      }
    },
    [projectId, selectedScene, refreshProject]
  );

  // ---------- Text overlay handlers ----------

  const handleAddText = useCallback(async () => {
    try {
      const item = await addTextItem(projectId, { text: "New Text" });
      addTextItemLocal(item);
      selectElement({ type: "text", id: item.id });
    } catch (err) {
      console.error("Failed to add text:", err);
    }
  }, [projectId, addTextItemLocal, selectElement]);

  const handleUpdateText = useCallback(
    async (textId: string, updates: Partial<TextItem>) => {
      updateTextItemLocal(textId, updates);
      try {
        await updateTextItem(projectId, textId, updates);
      } catch (err) {
        console.error("Failed to update text:", err);
      }
    },
    [projectId, updateTextItemLocal]
  );

  const handleDeleteText = useCallback(
    async (textId: string) => {
      removeTextItemLocal(textId);
      try {
        await deleteTextItem(projectId, textId);
      } catch (err) {
        console.error("Failed to delete text:", err);
      }
    },
    [projectId, removeTextItemLocal]
  );

  // ---------- Reorder scenes ----------

  const handleReorderScenes = useCallback(
    async (sceneIds: number[]) => {
      try {
        const { reorderScenes } = await import("@/lib/api");
        await reorderScenes(projectId, sceneIds as any);
        await refreshProject();
      } catch (err) {
        console.error("Failed to reorder scenes:", err);
      }
    },
    [projectId, refreshProject]
  );

  // ---------- Delete scene/transition ----------

  const handleDeleteScene = useCallback(
    async (sceneId: string, sceneNum: number) => {
      try {
        await deleteScene(projectId, sceneNum);
        if (selectedScene?.id === sceneId) selectScene(null);
        await refreshProject();
      } catch (err) {
        console.error("Failed to delete scene:", err);
      }
    },
    [projectId, selectedScene, selectScene, refreshProject]
  );

  const handleDeleteTransition = useCallback(
    async (fromSceneId: number, toSceneId: number) => {
      try {
        await deleteTransition(projectId, fromSceneId, toSceneId);
        await refreshProject();
      } catch (err) {
        console.error("Failed to delete transition:", err);
      }
    },
    [projectId, refreshProject]
  );

  // ---------- Color grade ----------

  const handleColorGradeChange = useCallback(
    (key: string, value: number) => {
      setColorGrade((prev) => {
        const next = { ...prev, [key]: value };
        if (colorGradeEffectId) {
          updateProjectEffect(projectId, colorGradeEffectId, {
            settings_json: JSON.stringify(next),
          }).catch(() => {});
        }
        return next;
      });
    },
    [colorGradeEffectId, projectId]
  );

  // ---------- Workflow execution ----------

  const handleExecuteWorkflow = useCallback(async () => {
    if (!workflow) return;
    try {
      await executeWorkflow(projectId);
      // Poll for status
      const poll = setInterval(async () => {
        try {
          const wf = await getWorkflow(projectId);
          setWorkflow(wf);
          if (wf.status !== "running") {
            clearInterval(poll);
            await refreshProject();
          }
        } catch {
          clearInterval(poll);
        }
      }, 2000);
    } catch (err) {
      console.error("Workflow execution failed:", err);
    }
  }, [workflow, projectId, setWorkflow, refreshProject]);

  // ---------- Save workflow on unmount ----------

  useEffect(() => {
    return () => {
      const wf = useWorkflowStore.getState().workflow;
      if (wf) {
        updateWorkflowFull(projectId, wf).catch(() => {});
      }
    };
  }, [projectId]);

  // ---------- Render download/delete ----------

  const handleDownloadRender = useCallback(async (path: string) => {
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
      window.open(clipUrl(`/files/${path}`), "_blank");
    }
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

  return {
    // Project state
    project,
    scenes,
    transitions,
    textItems,
    selectedSceneId,
    selectedElement,
    selectedScene,
    selectedTransition,
    totalDuration,
    clipsGenerated,
    allClipsDone,
    parsedTransitionClips,
    pickerImages,
    characterRefUrls,
    characterImages,

    // Workflow state
    workflow,
    selectedNodeId,
    selectedNode,
    setSelectedNode,
    setWorkflow,
    updateNodeParams,
    workflowLoading,
    needsStory,

    // Loading/progress state
    isLoading,
    isGenerating,
    error,
    clipJobs,
    generatingAll,
    allClipsProgress,
    isRendering,
    renderProgress,
    isPublishing,
    generatingCharacter,
    generatingTransition,
    extractingFrame,

    // Render state
    renderOpts,
    setRenderOpts,
    colorGrade,
    handleColorGradeChange,
    renders,
    audioDuration,
    videoTimeRef,

    // Scene handlers
    selectScene,
    selectElement,
    handleUpdateScene,
    handleUpdateTransition,

    // Generation handlers
    handleGenerateKeyframe,
    handleRegenerateClip,
    handleGenerateAllClips,
    handleGenerateTransition,
    handleRender,
    handleDownload,
    handleGenerateCharacter,
    handleExtractFrame,
    handleSetStartKeyframe,
    handleSetEndKeyframe,
    handleSetReferenceImages,

    // Text handlers
    handleAddText,
    handleUpdateText,
    handleDeleteText,
    updateTextItemLocal,
    handleReorderScenes,

    // Scene/transition delete
    handleDeleteScene,
    handleDeleteTransition,

    // Workflow handlers
    handleExecuteWorkflow,

    // Render handlers
    handleDownloadRender,
    handleDeleteRender,

    // Refresh
    refreshProject,
  };
}
