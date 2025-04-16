import { create } from 'zustand';

interface TimeRangeState {
  timeRange: string;
  setTimeRange: (newTimeRange: string) => void;
}

export const useTimeRangeStore = create<TimeRangeState>((set) => ({
  timeRange: '30', // Default to 30 days
  setTimeRange: (newTimeRange) => set({ timeRange: newTimeRange }),
}));