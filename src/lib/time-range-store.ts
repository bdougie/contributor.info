import { create } from 'zustand';

interface TimeRangeState {
  timeRange: string;
  timeRangeNumber: number; // Adding a numeric version
  effectiveTimeRange: string; // For mobile vs desktop distinction
  effectiveTimeRangeNumber: number; // Numeric version of effectiveTimeRange
  setTimeRange: (newTimeRange: string) => void;
}

// Helper to check if device is mobile
const isMobile = () => window.innerWidth < 768; // Matches Tailwind's md breakpoint

export const useTimeRangeStore = create<TimeRangeState>((set) => ({
  timeRange: '30', // Default to 30 days
  timeRangeNumber: 30, // Default numeric value
  effectiveTimeRange: '30', // Initial value
  effectiveTimeRangeNumber: 30, // Initial numeric value
  setTimeRange: (newTimeRange) =>
    set({
      timeRange: newTimeRange,
      timeRangeNumber: parseInt(newTimeRange, 10),
      // For mobile, we always use the default values regardless of user selection
      effectiveTimeRange: isMobile() ? '30' : newTimeRange,
      effectiveTimeRangeNumber: isMobile() ? 30 : parseInt(newTimeRange, 10),
    }),
}));

// Initialize window resize listener to update timeRange on viewport changes
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    const { timeRange } = useTimeRangeStore.getState();
    useTimeRangeStore.getState().setTimeRange(timeRange);
  });

  // Set initial values based on current viewport
  window.addEventListener('load', () => {
    const { timeRange } = useTimeRangeStore.getState();
    useTimeRangeStore.getState().setTimeRange(timeRange);
  });
}

// Convenience hook to use the timeRange store
export const useTimeRange = () => useTimeRangeStore();
