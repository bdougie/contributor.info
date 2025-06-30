// Mock for time-range-store in Storybook
import { fn } from "@storybook/test";

export const useTimeRangeStore = fn(() => ({
  timeRange: "last_30_days",
  setTimeRange: fn(),
  getDateRange: fn(() => ({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date()
  }))
}));

export const useTimeRange = fn(() => ({
  timeRange: "last_30_days",
  setTimeRange: fn()
}));