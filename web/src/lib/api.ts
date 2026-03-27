"use client";

const API_BASE = "http://localhost:8000";

export { API_BASE };

export const clipUrl = (path: string) =>
  path.startsWith("http") ? path : `${API_BASE}/${path.replace(/^\//, "")}`;

// --- Types ---

export interface Philosopher {
  id: string;
  name: string;
  civilization: string;
  era: string;
  character_description: string;
  character_image_url: string | null;
  character_ref_urls: string | null; // JSON array of reference image URLs
  quote_count: number;
  hook_count: number;
  truth_count: number;
}

export interface Quote {
  id: string;
  philosopher_id: string;
  text: string;
  short_version: string | null;
  emotional_function: "hook" | "truth" | "conflict" | "loop";
  theme: string;
  pair_with_visual: string;
  word_count: number;
  read_time_seconds: number;
  used_count: number;
}

export interface Scene {
  id: string;
  scene_id?: number;
  beat: string;
  duration: number;
  visual_description: string;
  text_overlay: string;
  camera: string;
  clip_url: string | null;
  quote_id: string | null;
  cta_scene?: boolean;
}

export interface Project {
  id: string;
  name: string;
  philosopher_id: string;
  philosopher_name: string;
  civilization: string;
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
  video_vibe: string;
  video_vibe_preset: string;
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

// Philosophers
export const getPhilosophers = () => fetchAPI<Philosopher[]>("/api/philosophers");
export const getPhilosopher = (id: string) => fetchAPI<Philosopher>(`/api/philosophers/${id}`);

// Philosopher mutations
export const updatePhilosopher = (id: string, data: Partial<Pick<Philosopher, "name" | "era" | "civilization" | "character_description">>) =>
  fetchAPI<Philosopher>(`/api/philosophers/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// Quotes
export const createQuote = (data: { philosopher_id: string; text: string; theme: string; emotional_function: string }) =>
  fetchAPI<Quote>("/api/quotes", { method: "POST", body: JSON.stringify(data) });
export const updateQuote = (id: string, data: Partial<Pick<Quote, "text" | "theme" | "emotional_function" | "pair_with_visual">>) =>
  fetchAPI<Quote>(`/api/quotes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteQuote = (id: string) =>
  fetchAPI<{ deleted: boolean }>(`/api/quotes/${id}`, { method: "DELETE" });

export const getQuotes = (params?: { philosopher_id?: string; function?: string; limit?: number }) => {
  const searchParams = new URLSearchParams();
  if (params?.philosopher_id) searchParams.set("philosopher", params.philosopher_id);
  if (params?.function) searchParams.set("function", params.function);
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  const qs = searchParams.toString();
  return fetchAPI<Quote[]>(`/api/quotes${qs ? `?${qs}` : ""}`);
};
export const getQuoteStats = () => fetchAPI<{ philosophers: unknown[] }>("/api/quotes/stats");
export const getStats = () => fetchAPI<Stats>("/api/stats");

// Projects
export const getProjects = () => fetchAPI<Project[]>("/api/projects");
export const getProject = (id: string) => fetchAPI<Project>(`/api/projects/${id}`);
export const createProject = (data: { philosopher_id: string; hook_quote_id?: string; truth_quote_id?: string }) =>
  fetchAPI<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<Project>) =>
  fetchAPI<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  fetchAPI<void>(`/api/projects/${id}`, { method: "DELETE" });

// Generate
export const generateStory = (data: {
  philosopher_id: string;
  hook_quote_id?: string;
  truth_quote_id?: string;
  quote_ids?: string[];
  target_duration?: number;
  arc_template?: string;
  theme?: string;
}) =>
  fetchAPI<StoryBreakdown>("/api/generate/story", { method: "POST", body: JSON.stringify(data) });
export const generateClips = (projectId: string) =>
  fetchAPI<{ job_id: string }>("/api/generate/clips", { method: "POST", body: JSON.stringify({ project_id: projectId }) });
export const generateClip = (projectId: string, sceneId: string) =>
  fetchAPI<{ job_id: string }>("/api/generate/clip", { method: "POST", body: JSON.stringify({ project_id: projectId, scene_id: sceneId }) });
export const renderProject = (projectId: string) =>
  fetchAPI<{ job_id: string }>("/api/generate/render", { method: "POST", body: JSON.stringify({ project_id: projectId }) });

// Scenes
export const getScenes = async (projectId: string): Promise<Scene[]> => {
  const data = await fetchAPI<{ scenes: Array<Scene & { clip_path?: string }>; total_duration: number }>(`/api/scenes/${projectId}`);
  // Map backend clip_path to frontend clip_url
  return (data.scenes ?? []).map((s, idx) => ({
    ...s,
    id: s.id ?? String(s.scene_id ?? idx),
    clip_url: s.clip_url ?? s.clip_path ?? null,
  }));
};
export const updateScene = (projectId: string, sceneId: string, data: Partial<Scene>) =>
  fetchAPI<Scene>(`/api/scenes/${projectId}/${sceneId}`, { method: "PATCH", body: JSON.stringify(data) });
export const reorderScenes = (projectId: string, sceneIds: string[]) =>
  fetchAPI<void>(`/api/scenes/${projectId}/reorder`, { method: "POST", body: JSON.stringify({ scene_ids: sceneIds }) });

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

// Character
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

export const getCharacterImages = (philosopherId: string) =>
  fetchAPI<{ philosopher_id: string; images: CharacterImage[] }>(`/api/character/images/${philosopherId}`);

export const generateCharacterForPhilosopher = (
  philosopherId: string,
  opts?: { theme?: string; force?: boolean; custom_description?: string },
) =>
  fetchAPI<{ image_url: string; local_path: string; theme: string; reused: boolean }>(
    "/api/character/generate-for-philosopher",
    { method: "POST", body: JSON.stringify({ philosopher_id: philosopherId, ...opts }) },
  );

// Publish
export const publishToYouTube = (projectId: string) =>
  fetchAPI<{ youtube_id: string }>("/api/publish", { method: "POST", body: JSON.stringify({ project_id: projectId }) });
