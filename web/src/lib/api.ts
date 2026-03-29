"use client";

const API_BASE = "http://localhost:8001";

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
  character_ref_urls: string | null; // JSON array of reference image URLs
  quote_count: number;
  hook_count: number;
  truth_count: number;
}

/** @deprecated Use Character instead */
export type Philosopher = Character;

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
  scene_id?: number;
  beat: string;
  duration: number;
  visual_description: string;
  text_overlay: string;
  camera: string;
  clip_url: string | null;
  keyframe_url: string | null;
  quote_id: string | null;
  cta_scene?: boolean;
  character_present?: boolean;
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
  narration_json?: string;
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
}

export interface ArcTemplate {
  id: string;
  name: string;
  description: string;
  min_duration: number;
  max_duration: number;
  min_scenes: number;
  max_scenes: number;
}

export interface Settings {
  openai_api_key: string;
  anthropic_api_key: string;
  fal_api_key: string;
  llm_provider: "openai" | "anthropic";
  llm_model: string;
  youtube_connected: boolean;
}

// --- API Functions ---

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Characters (formerly Philosophers)
export const getCharacters = () => fetchAPI<Character[]>("/api/characters");
export const getCharacter = (id: string) => fetchAPI<Character>(`/api/characters/${id}`);
export const updateCharacter = (id: string, data: Partial<Pick<Character, "name" | "era" | "group" | "character_description">>) =>
  fetchAPI<Character>(`/api/characters/${id}`, { method: "PATCH", body: JSON.stringify(data) });

/** @deprecated Use getCharacters */
export const getPhilosophers = getCharacters;
/** @deprecated Use getCharacter */
export const getPhilosopher = getCharacter;
/** @deprecated Use updateCharacter */
export const updatePhilosopher = (id: string, data: Partial<Pick<Character, "name" | "era" | "group" | "character_description">>) =>
  updateCharacter(id, data);

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
export const getQuotes = (params?: { philosopher_id?: string; character_id?: string; function?: string; limit?: number }) => {
  const character_id = params?.character_id ?? params?.philosopher_id;
  return getSourceItems({ character_id, function: params?.function, limit: params?.limit });
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
export const generateKeyframe = (projectId: string, sceneId: number) =>
  fetchAPI<{ job_id: string }>("/api/generate/keyframe", { method: "POST", body: JSON.stringify({ project_id: projectId, scene_id: sceneId }) });
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
export const getScenes = async (projectId: string): Promise<Scene[]> => {
  const data = await fetchAPI<{ scenes: Array<Scene & { clip_path?: string; keyframe_url?: string }>; total_duration: number }>(`/api/scenes/${projectId}`);
  // Map backend clip_path to frontend clip_url; pass through keyframe_url
  return (data.scenes ?? []).map((s, idx) => ({
    ...s,
    id: s.id ?? String(s.scene_id ?? idx),
    clip_url: s.clip_url ?? s.clip_path ?? null,
    keyframe_url: s.keyframe_url ?? null,
  }));
};
export const updateScene = (projectId: string, sceneId: string, data: Partial<Scene>) =>
  fetchAPI<Scene>(`/api/scenes/${projectId}/${sceneId}`, { method: "PATCH", body: JSON.stringify(data) });
export const reorderScenes = (projectId: string, sceneIds: string[]) =>
  fetchAPI<void>(`/api/scenes/${projectId}/reorder`, { method: "POST", body: JSON.stringify({ scene_ids: sceneIds }) });
export const copyKeyframe = (projectId: string, sourceSceneId: number, targetSceneIds: number[]) =>
  fetchAPI<{ copied_to: number[]; keyframe_url: string }>(`/api/scenes/${projectId}/copy-keyframe`, {
    method: "POST",
    body: JSON.stringify({ source_scene_id: sourceSceneId, target_scene_ids: targetSceneIds }),
  });

// Jobs
export const getJob = (id: string) => fetchAPI<Job>(`/api/jobs/${id}`);

// Settings
export const getSettings = () => fetchAPI<Settings>("/api/settings");
export const updateSettings = (data: Partial<Settings>) =>
  fetchAPI<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(data) });
export const getVibePresets = () =>
  fetchAPI<{ presets: Record<string, VibePreset> }>("/api/settings/vibe-presets");
export const getArcTemplates = () =>
  fetchAPI<{ templates: Record<string, ArcTemplate> }>("/api/settings/arc-templates");

// Character Image
export const generateCharacterImage = (projectId: string, customDescription?: string, theme?: string) =>
  fetchAPI<{ image_url: string; local_path: string; theme: string; reused: boolean }>("/api/character/generate", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, custom_description: customDescription, theme }),
  });

export interface CharacterImage {
  theme: string;
  theme_name: string;
  url: string | null;
  local_path: string | null;
}

export const getCharacterImages = (characterId: string) =>
  fetchAPI<{ character_id: string; images: CharacterImage[] }>(`/api/character/images/${characterId}`);

export const generateCharacterForCharacter = (
  characterId: string,
  opts?: { theme?: string; force?: boolean; custom_description?: string },
) =>
  fetchAPI<{ image_url: string; local_path: string; theme: string; reused: boolean }>(
    "/api/character/generate-for-character",
    { method: "POST", body: JSON.stringify({ character_id: characterId, ...opts }) },
  );

/** @deprecated Use generateCharacterForCharacter */
export const generateCharacterForPhilosopher = (
  characterId: string,
  opts?: { theme?: string; force?: boolean; custom_description?: string },
) => generateCharacterForCharacter(characterId, opts);

// Publish
export const publishToYouTube = (projectId: string) =>
  fetchAPI<{ youtube_id: string }>("/api/publish", { method: "POST", body: JSON.stringify({ project_id: projectId }) });

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
  const res = await fetch(`${API_BASE}/api/audio/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
};

export const reanalyzeAudio = (filename: string, beatsPerCut: number) =>
  fetchAPI<AudioAnalysis & { filename: string; file_path: string }>(`/api/audio/analyze/${filename}?beats_per_cut=${beatsPerCut}`);
