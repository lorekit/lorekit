import { create } from "zustand";
import type { Project, Scene } from "@/lib/api";

interface ProjectState {
  // Current project being edited
  project: Project | null;
  scenes: Scene[];
  selectedSceneId: string | null;

  // Loading states
  isLoading: boolean;
  isGenerating: boolean;

  // Actions
  setProject: (project: Project) => void;
  setScenes: (scenes: Scene[]) => void;
  selectScene: (sceneId: string | null) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  reset: () => void;

  // Computed
  selectedScene: () => Scene | null;
  totalDuration: () => number;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  scenes: [],
  selectedSceneId: null,
  isLoading: false,
  isGenerating: false,

  setProject: (project) => set({ project }),
  setScenes: (scenes) => set({ scenes, selectedSceneId: scenes[0]?.id ?? null }),
  selectScene: (sceneId) => set({ selectedSceneId: sceneId }),
  updateScene: (sceneId, updates) =>
    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  reset: () => set({ project: null, scenes: [], selectedSceneId: null, isLoading: false, isGenerating: false }),

  selectedScene: () => {
    const state = get();
    return state.scenes.find((s) => s.id === state.selectedSceneId) ?? null;
  },
  totalDuration: () => {
    return get().scenes.reduce((sum, s) => sum + s.duration, 0);
  },
}));
