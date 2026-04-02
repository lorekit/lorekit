import { create } from "zustand";
import type { Project, Scene, Transition } from "@/lib/api";
import { effectiveDuration } from "@/lib/api";

export type SelectedElement =
  | { type: "scene"; id: string }
  | { type: "transition"; fromSceneId: number; toSceneId: number }
  | null;

interface ProjectState {
  // Current project being edited
  project: Project | null;
  scenes: Scene[];
  transitions: Transition[];
  selectedSceneId: string | null;
  selectedElement: SelectedElement;

  // Loading states
  isLoading: boolean;
  isGenerating: boolean;

  // Actions
  setProject: (project: Project) => void;
  setScenes: (scenes: Scene[]) => void;
  setTransitions: (transitions: Transition[]) => void;
  selectScene: (sceneId: string | null) => void;
  selectElement: (element: SelectedElement) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  updateTransition: (fromSceneId: number, toSceneId: number, updates: Partial<Transition>) => void;
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  reset: () => void;

  // Computed
  selectedScene: () => Scene | null;
  selectedTransition: () => Transition | null;
  totalDuration: () => number;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  scenes: [],
  transitions: [],
  selectedSceneId: null,
  selectedElement: null,
  isLoading: false,
  isGenerating: false,

  setProject: (project) => set({ project }),
  setScenes: (scenes) => set((state) => ({
    scenes,
    // Preserve current selection if the scene still exists, otherwise select first
    selectedSceneId: scenes.some((s) => s.id === state.selectedSceneId)
      ? state.selectedSceneId
      : scenes[0]?.id ?? null,
    // Also preserve selectedElement if it's still valid
    selectedElement: state.selectedElement?.type === "scene"
      ? (scenes.some((s) => s.id === (state.selectedElement as { type: "scene"; id: string }).id) ? state.selectedElement : (scenes[0] ? { type: "scene" as const, id: scenes[0].id } : null))
      : state.selectedElement, // transitions always remain valid
  })),
  setTransitions: (transitions) => set({ transitions }),
  selectScene: (sceneId) => set({
    selectedSceneId: sceneId,
    selectedElement: sceneId ? { type: "scene", id: sceneId } : null,
  }),
  selectElement: (element) => set({
    selectedElement: element,
    selectedSceneId: element?.type === "scene" ? element.id : null,
  }),
  updateScene: (sceneId, updates) =>
    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)),
    })),
  updateTransition: (fromSceneId, toSceneId, updates) =>
    set((state) => ({
      transitions: state.transitions.map((t) =>
        t.from_scene_id === fromSceneId && t.to_scene_id === toSceneId
          ? { ...t, ...updates }
          : t
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  reset: () => set({ project: null, scenes: [], transitions: [], selectedSceneId: null, selectedElement: null, isLoading: false, isGenerating: false }),

  selectedScene: () => {
    const state = get();
    return state.scenes.find((s) => s.id === state.selectedSceneId) ?? null;
  },
  selectedTransition: () => {
    const state = get();
    const el = state.selectedElement;
    if (el?.type !== "transition") return null;
    return state.transitions.find(
      (t) => t.from_scene_id === el.fromSceneId && t.to_scene_id === el.toSceneId
    ) ?? null;
  },
  totalDuration: () => {
    const state = get();
    const sceneDur = state.scenes.reduce((sum, s) => sum + effectiveDuration(s), 0);
    const transDur = state.transitions.reduce((sum, t) => sum + effectiveDuration(t), 0);
    return sceneDur + transDur;
  },
}));
