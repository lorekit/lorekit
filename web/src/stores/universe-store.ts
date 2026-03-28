import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Universe } from "@/lib/api";
import { getUniverses } from "@/lib/api";

interface UniverseState {
  activeUniverseId: string;
  universes: Universe[];
  isLoading: boolean;

  setActiveUniverse: (id: string) => void;
  fetchUniverses: () => Promise<void>;
  setUniverses: (universes: Universe[]) => void;
  activeUniverse: () => Universe | undefined;
}

export const useUniverseStore = create<UniverseState>()(
  persist(
    (set, get) => ({
      activeUniverseId: "philosophywise",
      universes: [],
      isLoading: false,

      setActiveUniverse: (id) => set({ activeUniverseId: id }),

      fetchUniverses: async () => {
        set({ isLoading: true });
        try {
          const universes = await getUniverses();
          set({ universes });
          // If active universe doesn't exist in the list, default to first
          const state = get();
          if (universes.length > 0 && !universes.find((u) => u.id === state.activeUniverseId)) {
            set({ activeUniverseId: universes[0].id });
          }
        } catch {
          // keep existing
        } finally {
          set({ isLoading: false });
        }
      },

      setUniverses: (universes) => set({ universes }),

      activeUniverse: () => {
        const state = get();
        return state.universes.find((u) => u.id === state.activeUniverseId);
      },
    }),
    {
      name: "lorekit-universe",
      partialize: (state) => ({ activeUniverseId: state.activeUniverseId }),
    }
  )
);
