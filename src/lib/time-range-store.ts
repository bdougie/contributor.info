import { create } from 'zustand';

interface TimeRangeState {
  timeRange: string;
  timeRangeNumber: number; // Adding a numeric version
  setTimeRange: (newTimeRange: string) => void;
}

export const useTimeRangeStore = create<TimeRangeState>((set) => ({
  timeRange: '30', // Default to 30 days
  timeRangeNumber: 30, // Default numeric value
  setTimeRange: (newTimeRange) => set({ 
    timeRange: newTimeRange, 
    timeRangeNumber: parseInt(newTimeRange, 10) 
  }),
}));

// Convenience hook to use the timeRange store
export const useTimeRange = () => useTimeRangeStore();