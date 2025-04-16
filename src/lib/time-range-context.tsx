import React, { createContext, useContext, useState } from "react";

// Create TimeRangeContext
interface TimeRangeContextType {
  timeRange: string;
  setTimeRange: (value: string) => void;
}

export const TimeRangeContext = createContext<TimeRangeContextType>({
  timeRange: "30",
  setTimeRange: () => {},
});

// Helper hook to use the TimeRange context
export const useTimeRange = () => useContext(TimeRangeContext);

// TimeRangeProvider component
export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [timeRange, setTimeRange] = useState("30");

  return (
    <TimeRangeContext.Provider value={{ timeRange, setTimeRange }}>
      {children}
    </TimeRangeContext.Provider>
  );
}
