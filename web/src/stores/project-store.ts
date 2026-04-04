import { create } from "zustand";
import type { Project, Scene, Transition, TextItem } from "@/lib/api";
import { effectiveDuration } from "@/lib/api";

export type SelectedElement =
  | { type: "scene"; id: string }
  | { type: "transition"; fromSceneId: number; toSceneId: number }
  | { type: "text"; id: string }
  | { type: "full-video" }
  | null;

interface ProjectState {
  // Current project being edited
  project: Project | null;
  scenes: Scene[];
  transitions: Transition[];
  textItems: TextItem[];
  selectedSceneId: string | null;
  selectedElement: SelectedElement;

  // Loading states
  isLoading: boolean;
  isGenerating: boolean;

  // Actions
  setProject: (project: Project) => void;
  setScenes: (scenes: Scene[]) => void;
  setTransitions: (transitions: Transition[]) => void;
  setTextItems: (items: TextItem[]) => void;
  selectScene: (sceneId: string | null) => void;
  selectElement: (element: SelectedElement) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  updateTransition: (fromSceneId: number, toSceneId: number, updates: Partial<Transition>) => void;
  addTextItemLocal: (item: TextItem) => void;
  updateTextItemLocal: (id: string, updates: Partial<TextItem>) => void;
  removeTextItemLocal: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  reset: () => void;

  // Computed
  selectedScene: () => Scene | null;
  selectedTransition: () => Transition | null;
  selectedTextItem: () => TextItem | null;
  totalDuration: () => number;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  scenes: [],
  transitions: [],
  textItems: [],
  selectedSceneId: null,
  selectedElement: null,
  isLoading: false,
  isGenerating: false,

  setProject: (project) => set({ project }),
  setScenes: (scenes) => set((state) => ({
    scenes,
    selectedSceneId: scenes.some((s) => s.id === state.selectedSceneId)
      ? state.selectedSceneId
      : scenes[0]?.id ?? null,
    selectedElement: state.selectedElement?.type === "scene"
      ? (scenes.some((s) => s.id === (state.selectedElement as { type: "scene"; id: string }).id) ? state.selectedElement : (scenes[0] ? { type: "scene" as const, id: scenes[0].id } : null))
      : state.selectedElement,
  })),
  setTransitions: (transitions) => set({ transitions }),
  setTextItems: (textItems) => set({ textItems }),
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
    set((state) => {
      const exists = state.transitions.some(
        (t) => t.from_scene_id === fromSceneId && t.to_scene_id === toSceneId
      );
      if (exists) {
        return {
          transitions: state.transitions.map((t) =>
            t.from_scene_id === fromSceneId && t.to_scene_id === toSceneId
              ? { ...t, ...updates }
              : t
          ),
        };
      }
      return {
        transitions: [
          ...state.transitions,
          { id: "", from_scene_id: fromSceneId, to_scene_id: toSceneId, transition_type: "ai_morph", type: "ai_morph", prompt: "", duration: 3.0, from_frame: 0, duration_frames: 90, speed: 1.5, in_offset: 0, out_offset: 0, ...updates },
        ],
      };
    }),
  addTextItemLocal: (item) => set((state) => ({ textItems: [...state.textItems, item] })),
  updateTextItemLocal: (id, updates) =>
    set((state) => ({
      textItems: state.textItems.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTextItemLocal: (id) =>
    set((state) => ({
      textItems: state.textItems.filter((t) => t.id !== id),
      selectedElement: state.selectedElement?.type === "text" && state.selectedElement.id === id
        ? null
        : state.selectedElement,
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  reset: () => set({ project: null, scenes: [], transitions: [], textItems: [], selectedSceneId: null, selectedElement: null, isLoading: false, isGenerating: false }),

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
  selectedTextItem: () => {
    const state = get();
    const el = state.selectedElement;
    if (el?.type !== "text") return null;
    return state.textItems.find((t) => t.id === el.id) ?? null;
  },
  totalDuration: () => {
    const state = get();
    const sceneDur = state.scenes.reduce((sum, s) => sum + effectiveDuration(s), 0);
    const transDur = state.transitions.reduce((sum, t) => sum + effectiveDuration(t), 0);
    // Text items can extend beyond video — include their end frames
    const textEnd = state.textItems.length > 0
      ? Math.max(...state.textItems.map((t) => (t.from_frame + t.duration_frames) / 30))
      : 0;
    return Math.max(sceneDur + transDur, textEnd);
  },
}));
