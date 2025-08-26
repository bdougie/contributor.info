import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityType = 'opened' | 'closed' | 'merged' | 'reviewed' | 'commented';

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
    },
  ),
);
