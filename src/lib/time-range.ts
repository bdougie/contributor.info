import { createContext, useContext } from 'react';

// Create a context for time range that will be used throughout the app
export const TimeRangeContext = createContext<{
  timeRange: string;
  setTimeRange: React.Dispatch<React.SetStateAction<string>>;
}>({
  timeRange: '30', // Default to 30 days
  setTimeRange: () => {},
});

// Custom hook to easily access the time range context
export const useTimeRange = () => useContext(TimeRangeContext);