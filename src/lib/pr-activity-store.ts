import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityType =
  | 'opened'
  | 'closed'
  | 'merged'
  | 'reviewed'
  | 'commented'
  | 'starred'
  | 'forked';

interface PRActivityState {
  selectedTypes: ActivityType[];
  includeBots: boolean;
  setSelectedTypes: (types: ActivityType[]) => void;
  setIncludeBots: (include: boolean) => void;
  toggleActivityType: (type: ActivityType) => void;
}

export const usePRActivityStore = create<PRActivityState>()(
  persist(
    (set) => ({
      selectedTypes: ['opened', 'merged', 'commented'],
      includeBots: true,
      setSelectedTypes: (types) => set({ selectedTypes: types }),
      setIncludeBots: (include) => set({ includeBots: include }),
      toggleActivityType: (type) =>
        set((state) => ({
          selectedTypes: state.selectedTypes.includes(type)
            ? state.selectedTypes.filter((t) => t !== type)
            : [...state.selectedTypes, type],
        })),
    }),
    {
      name: 'pr-activity-settings',
      // Skip hydration during SSR - localStorage not available
      skipHydration: typeof window === 'undefined',
      // Add SSR-safe storage
      storage: {
        getItem: (name) => {
          if (typeof window === 'undefined') return null;
          try {
            const str = localStorage.getItem(name);
            return str ? JSON.parse(str) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          if (typeof window === 'undefined') return;
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch {
            // Silently fail
          }
        },
        removeItem: (name) => {
          if (typeof window === 'undefined') return;
          try {
            localStorage.removeItem(name);
          } catch {
            // Silently fail
          }
        },
      },
    }
  )
);
