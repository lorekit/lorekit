"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export { API_BASE };

export const clipUrl = (path: string) =>
  path.startsWith("http") ? path : `${API_BASE}/${path.replace(/^\//, "")}`;

// --- Types ---

export interface Character {
  id: string;
  name: string;
  group: string;
  era: string;
  character_description: string;
  character_image_url: string | null;
  character_styles_json: string | null; // {"theme": {"description": "...", "image_url": "...", "image_path": "..."}}
  character_ref_urls: string | null; // JSON array of reference image URLs
  quote_count: number;
  hook_count: number;
  truth_count: number;
}

export interface SourceItem {
  id: string;
  character_id: string;
  text: string;
  short_version: string | null;
  emotional_function: "hook" | "truth" | "conflict" | "loop";
  theme: string;
  pair_with_visual: string;
  word_count: number;
  read_time_seconds: number;
  used_count: number;
}

/** @deprecated Use SourceItem instead */
export type Quote = SourceItem;

export interface Scene {
  id: string;
  scene_id: number;
  beat: string;
  duration: number;           // seconds (duration_frames / fps)
  from_frame: number;
  duration_frames: number;
  visual_description: string;
  text_overlay: string;
  camera: string;
  clip_path: string | null;
  clip_url: string | null;
  keyframe_url: string | null;
  keyframe_path?: string | null;
  keyframe_history?: Array<{ url: string | null; path: string | null }> | null;
  end_keyframe_url?: string | null;
  extracted_frames?: Array<{ url: string | null; path: string | null }> | null;
  reference_images?: string[] | null;
  character_present?: boolean;
  speed?: number;
  enabled?: boolean;
  keyframe_node_id?: string | null;
  clip_node_id?: string | null;
}

export interface Transition {
  id: string;
  from_scene_id: number;      // computed from neighboring scenes
  to_scene_id: number;        // computed from neighboring scenes
  transition_type: string;    // "ai_morph", "hard_cut", "fade", "dissolve", etc.
  type: string;               // alias for transition_type (compat)
  prompt: string;
  duration: number;           // seconds
  from_frame: number;
  duration_frames: number;
  speed: number;              // playback speed multiplier (default 1.5)
  in_offset: number;
  out_offset: number;
  clip_path?: string | null;  // generated clip file path (ai_morph only)
  clip_url?: string | null;   // generated clip URL (ai_morph only)
  enabled?: boolean;
  start_image_url?: string | null;  // optional override for morph start frame
  end_image_url?: string | null;    // optional override for morph end frame
}

export interface TextItem {
  id: string;
  text: string;
  font_family: string;
  font_size: number;
  color: string;
  font_weight: number;        // 100-900 (400=normal, 700=bold)
  font_style: string;         // "normal" | "italic"
  text_decoration: string;    // "none" | "underline"
  position: { x: number; y: number };
  width: number;              // container width as fraction of video (0.1-1.0)
  from_frame: number;
  duration_frames: number;
  duration: number;           // seconds
  animation: { enter: string; exit: string } | null;
  enabled: boolean;
}

/** Compute effective timeline duration: clip length / speed */
export function effectiveDuration(item: { duration: number; speed?: number }): number {
  return item.duration / (item.speed ?? 1.0);
}

export interface Project {
  id: string;
  name: string;
  character_id: string;
  character_name: string;
  universe_id?: string;
  hook_quote: string;
  truth_quote: string;
  hook_quote_id: string;
  truth_quote_id: string;
  status: "draft" | "story_ready" | "generating" | "clips_ready" | "assembling" | "rendered" | "published";
  scenes: Scene[];
  output_path: string | null;
  youtube_id: string | null;
  youtube_title: string | null;
  cost_usd: number;
  created_at: string;
  updated_at: string;
  thumbnail_url: string | null;
  character_image_url: string | null;
  character_image_path: string | null;
  audio_mode?: string;
  uploaded_audio_path?: string;
  timeline?: Record<string, unknown>;
}

export interface ProjectEffect {
  id: string;
  project_id: string;
  effect_type: string;
  name: string;
  start_time: number;
  end_time: number | null;
  sort_order: number;
  settings_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface Universe {
  id: string;
  name: string;
  description: string;
  icon: string;
  video_vibe_preset: string;
  character_count: number;
  project_count: number;
  created_at: string;
}

export interface Environment {
  id: string;
  universe_id: string;
  name: string;
  color_grade_json: string | null;
  font: string;
  text_color: string;
  text_shadow: string;
  environment_description: string;
  themed_descriptions_json: string | null;
}

export interface SceneTemplate {
  id: string;
  universe_id: string;
  name: string;
  description: string;
  beats_json: string | null;
  min_duration: number;
  max_duration: number;
  min_scenes: number;
  max_scenes: number;
}

export interface StoryBreakdown {
  project_id: string;
  scenes?: Scene[];
  story?: {
    scenes: Scene[];
    [key: string]: unknown;
  };
}

export interface Job {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  result: unknown;
}

export interface Stats {
  videos: { total: number; total_cost: number; avg_cost: number };
  quotes: { total_quotes: number; total_uses: number; avg_uses: number };
  cost_breakdown: { component: string; total: number }[];
}

export interface VibePreset {
  name: string;
  description: string;
  prompt: string;
  character_prompt?: string;
  is_builtin?: boolean;
}

export interface VideoStyle {
  id: string;
  name: string;
  description: string;
  prompt: string;
  character_prompt: string;
  image_model: string;  // "kontext" or "nano_banana_2"
  is_builtin: number;
  organization_id: string;
  created_at: string;
}

export interface ArcTemplate {
  id: string;
  name: string;
  description: string;
  min_duration: number;
  max_duration: number;
  min_scenes: number;
  max_scenes: number;
  is_builtin?: boolean;
}

export interface Settings {
  openai_api_key?: string;
  anthropic_api_key?: string;
  fal_key?: string;
  llm_provider: "openai" | "anthropic";
  llm_model: string;
}

// --- API Functions ---

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  // Inject Bearer token if available (cloud mode)
  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("lorekit_token");
    if (token) {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { ...authHeaders, ...options?.headers },
    ...options,
  });

  // Handle auth errors — try refreshing the bearer token before giving up
  if (res.status === 401 && typeof window !== "undefined") {
    const { refreshAuthToken } = await import("@/lib/auth-client");
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      // Retry the original request with the new token
      const newToken = localStorage.getItem("lorekit_token");
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...authHeaders,
          ...options?.headers,
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
        },
      });
      if (retryRes.ok) {
        return retryRes.json() as Promise<T>;
      }
    }
    // Refresh failed or retry failed — redirect to login
    localStorage.removeItem("lorekit_token");
    window.location.href = "/login";
    throw new Error("Authentication required");
  }

  // Handle insufficient credits — dispatch event for modal
  if (res.status === 402 && typeof window !== "undefined") {
    let detail = "Insufficient credits";
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {}
    window.dispatchEvent(new CustomEvent("lorekit:insufficient-credits", { detail }));
    throw new Error(detail);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {}
    throw new Error(`API error: ${res.status} — ${detail}`);
  }
  return res.json();
}

// Characters
export const getCharacters = () => fetchAPI<Character[]>("/api/characters");
export const getCharacter = (id: string) => fetchAPI<Character>(`/api/characters/${id}`);
export const updateCharacter = (id: string, data: Partial<Pick<Character, "name" | "era" | "group" | "character_description">>) =>
  fetchAPI<Character>(`/api/characters/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// Source Items (formerly Quotes)
export const createSourceItem = (data: { character_id: string; text: string; theme: string; emotional_function: string }) =>
  fetchAPI<SourceItem>("/api/sources", { method: "POST", body: JSON.stringify(data) });
export const updateSourceItem = (id: string, data: Partial<Pick<SourceItem, "text" | "theme" | "emotional_function" | "pair_with_visual">>) =>
  fetchAPI<SourceItem>(`/api/sources/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteSourceItem = (id: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/sources/${id}`, { method: "DELETE" });

export const getSourceItems = (params?: { character_id?: string; function?: string; limit?: number }) => {
  const searchParams = new URLSearchParams();
  if (params?.character_id) searchParams.set("character", params.character_id);
  if (params?.function) searchParams.set("function", params.function);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  const qs = searchParams.toString();
  return fetchAPI<SourceItem[]>(`/api/sources${qs ? `?${qs}` : ""}`);
};
export const getSourceStats = () => fetchAPI<{ characters: unknown[] }>("/api/sources/stats");

/** @deprecated Use createSourceItem */
export const createQuote = (data: { character_id: string; text: string; theme: string; emotional_function: string }) =>
  createSourceItem(data);
/** @deprecated Use updateSourceItem */
export const updateQuote = (id: string, data: Partial<Pick<SourceItem, "text" | "theme" | "emotional_function" | "pair_with_visual">>) =>
  updateSourceItem(id, data);
/** @deprecated Use deleteSourceItem */
export const deleteQuote = (id: string) => deleteSourceItem(id);
/** @deprecated Use getSourceItems */
export const getQuotes = (params?: { character_id?: string; function?: string; limit?: number }) => {
  return getSourceItems({ character_id: params?.character_id, function: params?.function, limit: params?.limit });
};
/** @deprecated Use getSourceStats */
export const getQuoteStats = getSourceStats;

export const getStats = () => fetchAPI<Stats>("/api/stats");

// Universes
export const getUniverses = () => fetchAPI<Universe[]>("/api/universes");
export const getUniverse = (id: string) => fetchAPI<Universe>(`/api/universes/${id}`);
export const createUniverse = (data: { name: string; description?: string; icon?: string; video_vibe_preset?: string }) =>
  fetchAPI<Universe>("/api/universes", { method: "POST", body: JSON.stringify(data) });
export const updateUniverse = (id: string, data: Partial<Pick<Universe, "name" | "description" | "icon" | "video_vibe_preset">>) =>
  fetchAPI<Universe>(`/api/universes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteUniverse = (id: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/universes/${id}`, { method: "DELETE" });

// Universe-scoped resources
export const getUniverseCharacters = (universeId: string) =>
  fetchAPI<Character[]>(`/api/universes/${universeId}/characters`);
export const getUniverseProjects = (universeId: string) =>
  fetchAPI<Project[]>(`/api/universes/${universeId}/projects`);
export const getUniverseSources = (universeId: string) =>
  fetchAPI<SourceItem[]>(`/api/universes/${universeId}/sources`);

// Universe Environments
export const getUniverseEnvironments = (universeId: string) =>
  fetchAPI<Environment[]>(`/api/universes/${universeId}/environments`);
export const createEnvironment = (universeId: string, data: {
  name: string;
  color_grade?: Record<string, number>;
  font?: string;
  text_color?: string;
  text_shadow?: string;
  environment_description?: string;
  themed_descriptions?: Record<string, string>;
}) =>
  fetchAPI<Environment>(`/api/universes/${universeId}/environments`, { method: "POST", body: JSON.stringify(data) });
export const updateEnvironment = (universeId: string, envId: string, data: Partial<{
  name: string;
  color_grade: Record<string, number>;
  font: string;
  text_color: string;
  text_shadow: string;
  environment_description: string;
  themed_descriptions: Record<string, string>;
}>) =>
  fetchAPI<Environment>(`/api/universes/${universeId}/environments/${envId}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteEnvironment = (universeId: string, envId: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/universes/${universeId}/environments/${envId}`, { method: "DELETE" });

// Universe Story Templates (DB table still named scene_templates)
export const getUniverseTemplates = (universeId: string) =>
  fetchAPI<SceneTemplate[]>(`/api/universes/${universeId}/templates`);
export const createTemplate = (universeId: string, data: {
  name: string;
  description?: string;
  beats?: unknown[];
  min_duration?: number;
  max_duration?: number;
  min_scenes?: number;
  max_scenes?: number;
}) =>
  fetchAPI<SceneTemplate>(`/api/universes/${universeId}/templates`, { method: "POST", body: JSON.stringify(data) });
export const updateTemplate = (universeId: string, tmplId: string, data: Partial<{
  name: string;
  description: string;
  beats: unknown[];
  min_duration: number;
  max_duration: number;
  min_scenes: number;
  max_scenes: number;
}>) =>
  fetchAPI<SceneTemplate>(`/api/universes/${universeId}/templates/${tmplId}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteTemplate = (universeId: string, tmplId: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/universes/${universeId}/templates/${tmplId}`, { method: "DELETE" });

// Projects
export const getProjects = () => fetchAPI<Project[]>("/api/projects");
export const getProject = (id: string) => fetchAPI<Project>(`/api/projects/${id}`);
export const createProject = (data: { character_id: string; hook_quote_id?: string; truth_quote_id?: string }) =>
  fetchAPI<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<Project>) =>
  fetchAPI<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  fetchAPI<void>(`/api/projects/${id}`, { method: "DELETE" });

// Generate
export const generateStory = (data: {
  character_id: string;
  hook_quote_id?: string;
  truth_quote_id?: string;
  quote_ids?: string[];
  target_duration?: number;
  aspect_ratio?: string;
  arc_template?: string;
  theme?: string;
  audio_mode?: string;
  uploaded_audio_path?: string;
}) =>
  fetchAPI<StoryBreakdown>("/api/generate/story", { method: "POST", body: JSON.stringify(data) });
export const generateClips = (projectId: string) =>
  fetchAPI<{ job_id: string }>("/api/generate/clips", { method: "POST", body: JSON.stringify({ project_id: projectId }) });
export const generateClip = (projectId: string, sceneId: string) =>
  fetchAPI<{ job_id: string }>("/api/generate/clip", { method: "POST", body: JSON.stringify({ project_id: projectId, scene_id: sceneId }) });
export const generateKeyframe = (projectId: string, sceneId: number, referenceImageUrls?: string[]) =>
  fetchAPI<{ job_id: string }>("/api/generate/keyframe", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      scene_id: sceneId,
      ...(referenceImageUrls?.length ? { reference_image_urls: referenceImageUrls } : {}),
    }),
  });
export const generateTransition = (projectId: string, fromSceneId: number, toSceneId: number, prompt?: string, duration?: number) =>
  fetchAPI<{ job_id: string }>("/api/generate/transition", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      from_scene_id: fromSceneId,
      to_scene_id: toSceneId,
      ...(prompt ? { prompt } : {}),
      ...(duration ? { duration } : {}),
    }),
  });

export interface RenderOptions {
  raw?: boolean;
  text_overlays?: boolean;
  color_grade?: boolean;
  audio?: boolean;
}
export const renderProject = (projectId: string, options: RenderOptions = {}) =>
  fetchAPI<{ job_id: string }>("/api/generate/render", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, ...options }),
  });

// Scenes
export const getScenes = async (projectId: string): Promise<{ scenes: Scene[]; transitions: Transition[]; text_items: TextItem[] }> => {
  const data = await fetchAPI<{ scenes: Array<Scene & { clip_path?: string }>; transitions?: Transition[]; text_items?: TextItem[]; total_duration: number }>(`/api/scenes/${projectId}`);
  const scenes = (data.scenes ?? []).map((s, idx) => ({
    ...s,
    id: s.id ?? String(s.scene_id ?? idx),
    clip_url: s.clip_url ?? (s.clip_path ? `/files/${s.clip_path}` : null),
    keyframe_url: s.keyframe_url ?? null,
    keyframe_path: s.keyframe_path ?? null,
    keyframe_history: s.keyframe_history ?? null,
    end_keyframe_url: s.end_keyframe_url ?? null,
    extracted_frames: s.extracted_frames ?? null,
  }));
  const transitions = data.transitions ?? [];
  const text_items = data.text_items ?? [];
  return { scenes, transitions, text_items };
};

// Text items
export const addTextItem = async (projectId: string, data: Partial<TextItem> = {}): Promise<TextItem> =>
  fetchAPI<TextItem>(`/api/scenes/${projectId}/text`, { method: "POST", body: JSON.stringify(data) });

export const updateTextItem = async (projectId: string, textId: string, updates: Partial<TextItem>): Promise<TextItem> =>
  fetchAPI<TextItem>(`/api/scenes/${projectId}/text/${textId}`, { method: "PATCH", body: JSON.stringify(updates) });

export const deleteTextItem = async (projectId: string, textId: string): Promise<{ deleted: string }> =>
  fetchAPI<{ deleted: string }>(`/api/scenes/${projectId}/text/${textId}`, { method: "DELETE" });
export const updateScene = (projectId: string, sceneId: string, data: Partial<Scene>) =>
  fetchAPI<Scene>(`/api/scenes/${projectId}/${sceneId}`, { method: "PATCH", body: JSON.stringify(data) });
export const updateTransition = (projectId: string, fromId: number, toId: number, data: Partial<Transition>) =>
  fetchAPI<Transition>(`/api/scenes/${projectId}/transition/${fromId}/${toId}`, { method: "PATCH", body: JSON.stringify(data) });
export const reorderScenes = (projectId: string, sceneIds: string[]) =>
  fetchAPI<void>(`/api/scenes/${projectId}/reorder`, { method: "POST", body: JSON.stringify({ scene_ids: sceneIds }) });
export const copyKeyframe = (projectId: string, sourceSceneId: number, targetSceneIds: number[]) =>
  fetchAPI<{ copied_to: number[]; keyframe_url: string }>(`/api/scenes/${projectId}/copy-keyframe`, {
    method: "POST",
    body: JSON.stringify({ source_scene_id: sourceSceneId, target_scene_ids: targetSceneIds }),
  });

export const extractFrame = (projectId: string, sceneId: number, timestamp: number) =>
  fetchAPI<{ url: string; path: string; timestamp: number }>("/api/generate/extract-frame", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, scene_id: sceneId, timestamp }),
  });
export const setStartKeyframe = (projectId: string, sceneId: number, keyframeUrl: string | null, keyframePath?: string | null) =>
  fetchAPI<{ scene_id: number; keyframe_url: string | null }>(`/api/scenes/${projectId}/${sceneId}/start-keyframe`, {
    method: "POST",
    body: JSON.stringify({ keyframe_url: keyframeUrl, ...(keyframePath ? { keyframe_path: keyframePath } : {}) }),
  });
export const setEndKeyframe = (projectId: string, sceneId: number, endKeyframeUrl: string | null) =>
  fetchAPI<{ scene_id: number; end_keyframe_url: string | null }>(`/api/scenes/${projectId}/${sceneId}/end-keyframe`, {
    method: "POST",
    body: JSON.stringify({ end_keyframe_url: endKeyframeUrl }),
  });

export const setReferenceImages = (projectId: string, sceneId: number, urls: string[]) =>
  fetchAPI<{ scene_id: number; reference_images: string[] }>(`/api/scenes/${projectId}/${sceneId}/reference-images`, {
    method: "POST",
    body: JSON.stringify({ urls }),
  });
export const deleteScene = (projectId: string, sceneId: number) =>
  fetchAPI<{ deleted: number; scene_count: number }>(`/api/scenes/${projectId}/${sceneId}`, { method: "DELETE" });
export const deleteTransition = (projectId: string, fromId: number, toId: number) =>
  fetchAPI<{ deleted: string }>(`/api/scenes/${projectId}/transition/${fromId}/${toId}`, { method: "DELETE" });

// Jobs
export const getJob = (id: string) => fetchAPI<Job>(`/api/jobs/${id}`);

// Settings
export const getSettings = () => fetchAPI<Settings>("/api/settings");
export const updateSettings = (data: Partial<Settings>) =>
  fetchAPI<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(data) });
export const getVibePresets = () =>
  fetchAPI<{ presets: Record<string, VibePreset>; styles: VideoStyle[] }>("/api/settings/vibe-presets");
export const getArcTemplates = () =>
  fetchAPI<{ templates: Record<string, ArcTemplate> }>("/api/settings/arc-templates");
export const createArcTemplate = (data: {
  name: string; description?: string; min_duration?: number; max_duration?: number;
  min_scenes?: number; max_scenes?: number; max_scene_duration?: number;
  beats_json?: string; system_prompt_fragment?: string;
}) =>
  fetchAPI<ArcTemplate & { id: string }>("/api/settings/arc-templates", { method: "POST", body: JSON.stringify(data) });
export const deleteArcTemplate = (id: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/settings/arc-templates/${id}`, { method: "DELETE" });
export const duplicateArcTemplate = (id: string) =>
  fetchAPI<ArcTemplate & { id: string }>(`/api/settings/arc-templates/${id}/duplicate`, { method: "POST" });

// Video Styles CRUD
export const listVideoStyles = () =>
  fetchAPI<{ styles: VideoStyle[] }>("/api/settings/video-styles");
export const createVideoStyle = (data: { name: string; description?: string; prompt: string; character_prompt?: string; image_model?: string }) =>
  fetchAPI<VideoStyle>("/api/settings/video-styles", { method: "POST", body: JSON.stringify(data) });
export const updateVideoStyle = (id: string, data: Partial<Pick<VideoStyle, "name" | "description" | "prompt" | "character_prompt" | "image_model">>) =>
  fetchAPI<VideoStyle>(`/api/settings/video-styles/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteVideoStyle = (id: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/settings/video-styles/${id}`, { method: "DELETE" });
export const duplicateVideoStyle = (id: string) =>
  fetchAPI<VideoStyle>(`/api/settings/video-styles/${id}/duplicate`, { method: "POST" });

// Character Image
export const generateCharacterImage = (projectId: string, customDescription?: string, theme?: string) =>
  fetchAPI<{ image_url: string; local_path: string; theme: string; reused: boolean }>("/api/character/generate", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, custom_description: customDescription, theme }),
  });

export interface CharacterImageEntry {
  url: string | null;
  path: string | null;
  label: string;
  prompt?: string;
}

export interface CharacterImageTheme {
  theme: string;
  theme_name: string;
  images: CharacterImageEntry[];
}

export const getCharacterImages = (characterId: string) =>
  fetchAPI<{ character_id: string; themes: CharacterImageTheme[] }>(`/api/character/images/${characterId}`);

export const deleteCharacterImage = (characterId: string, theme: string, index: number) =>
  fetchAPI<{ deleted: boolean }>(`/api/character/images/${characterId}`, {
    method: "DELETE",
    body: JSON.stringify({ theme, index }),
  });

export const setDefaultCharacterImage = (characterId: string, theme: string, index: number) =>
  fetchAPI<{ ok: boolean }>(`/api/character/images/${characterId}/set-default`, {
    method: "PATCH",
    body: JSON.stringify({ theme, index }),
  });

export const generateCharacterForCharacter = (
  characterId: string,
  opts?: { theme?: string; force?: boolean; custom_description?: string; view?: string },
) =>
  fetchAPI<{ image_url: string; local_path: string; theme: string; reused: boolean; view?: string }>(
    "/api/character/generate-for-character",
    { method: "POST", body: JSON.stringify({ character_id: characterId, ...opts }) },
  );

// Character Reference Images
export const getCharacterReferenceImages = (characterId: string) =>
  fetchAPI<{ character_id: string; urls: string[] }>(`/api/character/reference-images/${characterId}`);

export const uploadCharacterReferenceImage = async (characterId: string, file: File): Promise<{ url: string; urls: string[] }> => {
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("lorekit_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/api/character/reference-images/${characterId}`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
};

export const deleteCharacterReferenceImage = (characterId: string, url: string) =>
  fetchAPI<{ urls: string[] }>(`/api/character/reference-images/${characterId}`, {
    method: "DELETE",
    body: JSON.stringify({ url }),
  });

// Project Effects
export const getProjectEffects = (projectId: string) =>
  fetchAPI<ProjectEffect[]>(`/api/projects/${projectId}/effects`);
export const createProjectEffect = (projectId: string, data: {
  effect_type?: string;
  name?: string;
  settings_json?: string;
  start_time?: number;
  end_time?: number | null;
  sort_order?: number;
}) =>
  fetchAPI<ProjectEffect>(`/api/projects/${projectId}/effects`, { method: "POST", body: JSON.stringify(data) });
export const updateProjectEffect = (projectId: string, effectId: string, data: Partial<{
  name: string;
  settings_json: string;
  start_time: number;
  end_time: number | null;
  sort_order: number;
  enabled: number;
}>) =>
  fetchAPI<ProjectEffect>(`/api/projects/${projectId}/effects/${effectId}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteProjectEffect = (projectId: string, effectId: string) =>
  fetchAPI<{ deleted: string }>(`/api/projects/${projectId}/effects/${effectId}`, { method: "DELETE" });

// Render History
export interface RenderRecord {
  id: string;
  output_path: string | null;
  history_path: string | null;
  timestamp: string | null;
  created_at: string;
}
export const getProjectRenders = (projectId: string) =>
  fetchAPI<{ renders: RenderRecord[] }>(`/api/projects/${projectId}/renders`);
export const deleteProjectRender = (projectId: string, jobId: string) =>
  fetchAPI<{ deleted: string }>(`/api/projects/${projectId}/renders/${jobId}`, { method: "DELETE" });

// Download
export interface ProjectAsset {
  path: string;
  filename: string;
  category: string;
  url: string;
  scene_id?: number;
}

export const downloadProjectFile = (projectId: string, type: "render" | "clip" | "raw" = "render", sceneId?: number) =>
  fetchAPI<{ url: string }>(`/api/projects/${projectId}/download?type=${type}${sceneId != null ? `&scene_id=${sceneId}` : ""}`);

export const listProjectAssets = (projectId: string) =>
  fetchAPI<{ project_id: string; project_name: string; assets: ProjectAsset[]; count: number }>(`/api/projects/${projectId}/assets`);

// --- Scripts ---

export interface Script {
  id: string;
  universe_id: string;
  title: string;
  script_type: 'idea' | 'outline' | 'full_script';
  content: string;
  character_ids_json: string | null;
  target_duration_seconds: number | null;
  scene_count: number | null;
  status: 'draft' | 'review' | 'ready' | 'archived';
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export const getUniverseScripts = (universeId: string, params?: { character_id?: string; script_type?: string }) => {
  const qs = new URLSearchParams();
  if (params?.character_id) qs.set("character_id", params.character_id);
  if (params?.script_type) qs.set("script_type", params.script_type);
  return fetchAPI<Script[]>(`/api/universes/${universeId}/scripts${qs.toString() ? `?${qs}` : ""}`);
};

export const getScript = (universeId: string, scriptId: string) =>
  fetchAPI<Script>(`/api/universes/${universeId}/scripts/${scriptId}`);

export const createScript = (universeId: string, data: { title: string; script_type?: string; content?: string; character_ids?: string[]; target_duration_seconds?: number }) =>
  fetchAPI<Script>(`/api/universes/${universeId}/scripts`, { method: "POST", body: JSON.stringify(data) });

export const updateScript = (universeId: string, scriptId: string, data: Partial<{ title: string; script_type: string; content: string; character_ids: string[]; status: string; target_duration_seconds: number; scene_count: number }>) =>
  fetchAPI<Script>(`/api/universes/${universeId}/scripts/${scriptId}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteScript = (universeId: string, scriptId: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/universes/${universeId}/scripts/${scriptId}`, { method: "DELETE" });

// --- Character Documents (Knowledge Base) ---

export interface CharacterDocument {
  id: string;
  character_id: string;
  universe_id: string;
  name: string;
  doc_type: 'text' | 'pdf' | 'url';
  content: string | null;
  file_path: string | null;
  file_size_bytes: number;
  chunk_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export const getCharacterDocuments = (universeId: string, characterId: string) =>
  fetchAPI<CharacterDocument[]>(`/api/universes/${universeId}/characters/${characterId}/documents/`);

export const createCharacterDocument = (universeId: string, characterId: string, data: { name: string; doc_type?: string; content: string }) =>
  fetchAPI<CharacterDocument>(`/api/universes/${universeId}/characters/${characterId}/documents/`, { method: "POST", body: JSON.stringify(data) });

export const deleteCharacterDocument = (universeId: string, characterId: string, docId: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/universes/${universeId}/characters/${characterId}/documents/${docId}`, { method: "DELETE" });

export const processCharacterDocument = (universeId: string, characterId: string, docId: string) =>
  fetchAPI<{ chunks_created: number }>(`/api/universes/${universeId}/characters/${characterId}/documents/${docId}/process`, { method: "POST" });

// --- Character Voices ---

export interface CharacterVoice {
  id: string;
  character_id: string;
  tts_model: string;
  voice_id: string | null;
  voice_name: string;
  reference_audio_path: string | null;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudioAnalysis {
  duration_seconds: number;
  sample_rate: number;
  channels: number;
  segments: Array<{
    index: number;
    start: number;
    end: number;
    duration: number;
    transition: 'hard_cut' | 'flash' | 'zoom' | 'fade' | 'whip_pan';
    energy_level: number;
    camera_speed: 'slow' | 'medium' | 'fast';
    has_bass_drop: boolean;
  }>;
  segment_count: number;
  beats_per_cut?: number;
  analysis_type: 'beat_synced' | 'simple';
  beats?: {
    bpm: number;
    beat_count: number;
    beat_times: number[];
    strong_onset_times: number[];
  };
  energy?: {
    bass_drop_times: number[];
    bass_drop_count: number;
    avg_energy: number;
    peak_energy: number;
  };
  sections?: Array<{
    index: number;
    label: string;
    start: number;
    end: number;
    duration: number;
  }>;
}

export interface TTSModel {
  name: string;
  supports_voice_id: boolean;
  supports_reference_audio: boolean;
}

export const getCharacterVoice = (universeId: string, characterId: string) =>
  fetchAPI<CharacterVoice | null>(`/api/universes/${universeId}/characters/${characterId}/voice`);

export const upsertCharacterVoice = (universeId: string, characterId: string, data: { tts_model: string; voice_id?: string; voice_name?: string }) =>
  fetchAPI<CharacterVoice>(`/api/universes/${universeId}/characters/${characterId}/voice`, { method: "PUT", body: JSON.stringify(data) });

export const deleteCharacterVoice = (universeId: string, characterId: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/universes/${universeId}/characters/${characterId}/voice`, { method: "DELETE" });

export const getTTSModels = () =>
  fetchAPI<Record<string, TTSModel>>("/api/tts-models");

// --- Transitions ---

export interface TransitionType {
  label: string;
  ffmpeg: string | null;
  duration: number;
}

export interface TransitionTypes {
  [category: string]: {
    [key: string]: TransitionType;
  };
}

export const getTransitions = () =>
  fetchAPI<{ transitions: TransitionTypes }>("/api/audio/transitions");

export const getTransitionsFlat = () =>
  fetchAPI<{ transitions: Record<string, TransitionType> }>("/api/audio/transitions/flat");

export const uploadAudio = async (file: File): Promise<AudioAnalysis & { filename: string; file_path: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("lorekit_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/api/audio/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
};

export const reanalyzeAudio = (filename: string, beatsPerCut: number) =>
  fetchAPI<AudioAnalysis & { filename: string; file_path: string }>(`/api/audio/analyze/${filename}?beats_per_cut=${beatsPerCut}`);

// --- Billing ---

export interface Subscription {
  balance: number;
  unlimited: boolean;
  plan_tier?: string;
  plan_credits?: number;
  status?: string;
  current_period_end?: string;
  billing_interval?: string;
  auto_refill_enabled?: boolean;
  auto_refill_threshold?: number;
  auto_refill_credits?: number;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  balance_after: number;
  source: string;
  reference_id?: string;
  description?: string;
  metadata_json?: Record<string, unknown>;
  created_at: string;
}

export interface UsageResponse {
  entries: LedgerEntry[];
  total: number;
  unlimited: boolean;
}

export const getSubscription = () =>
  fetchAPI<Subscription>("/api/billing/subscription");

export const getUsageHistory = (limit = 50, offset = 0) =>
  fetchAPI<UsageResponse>(`/api/billing/usage?limit=${limit}&offset=${offset}`);

// Subscription checkout and portal are handled by BA client SDK:
// authClient.subscription.upgrade() and authClient.subscription.cancel()

export const createPaygCheckout = (credits = 1000, successUrl?: string, cancelUrl?: string) =>
  fetchAPI<{ url: string; session_id: string }>("/api/billing/checkout/payg", {
    method: "POST",
    body: JSON.stringify({
      credits,
      ...(successUrl && { success_url: successUrl }),
      ...(cancelUrl && { cancel_url: cancelUrl }),
    }),
  });

export const updateAutoRefill = (enabled: boolean, threshold = 100, credits = 1000) =>
  fetchAPI<{ ok: boolean }>("/api/billing/auto-refill", {
    method: "PUT",
    body: JSON.stringify({ enabled, threshold, credits }),
  });

export const getBillingAnalytics = () =>
  fetchAPI<BillingAnalytics>("/api/billing/analytics");

export interface BillingAnalytics {
  daily_usage: { date: string; credits: number }[];
  by_source: { source: string; total: number }[];
  top_projects: { reference_id: string; total: number; description: string }[];
  burn_rate: number;
  days_remaining: number | null;
}

// --- Workflow Types ---

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  params: Record<string, any>;
  inputs: Record<string, string>;
  outputs: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  error: string | null;
  cost: number;
  position: { x: number; y: number };
}

export interface Workflow {
  id: string;
  project_id: string;
  name: string;
  nodes: Record<string, WorkflowNode>;
  status: "draft" | "running" | "completed" | "failed" | "partial";
}

// --- Workflow API ---

export const getWorkflow = (projectId: string) =>
  fetchAPI<Workflow>(`/api/workflow/${projectId}`);

export const createWorkflow = (data: { project_id: string; name?: string }) =>
  fetchAPI<Workflow>("/api/workflow", { method: "POST", body: JSON.stringify(data) });

export const updateWorkflowFull = (projectId: string, workflow: Workflow) =>
  fetchAPI<Workflow>(`/api/workflow/${projectId}`, { method: "PUT", body: JSON.stringify(workflow) });

export const addWorkflowNode = (data: {
  workflow_id: string;
  type: string;
  label?: string;
  params?: Record<string, any>;
  inputs?: Record<string, string>;
}) =>
  fetchAPI<{ node_id: string; workflow: Workflow }>("/api/workflow/node", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const executeWorkflow = (workflowId: string) =>
  fetchAPI<{ job_id: string }>("/api/workflow/execute", {
    method: "POST",
    body: JSON.stringify({ workflow_id: workflowId }),
  });

export const getWorkflowNodeTypes = () =>
  fetchAPI<{
    node_types: Array<{
      type: string;
      category: string;
      label: string;
      input_keys: string[];
      output_keys: string[];
    }>;
  }>("/api/workflow/node-types");
