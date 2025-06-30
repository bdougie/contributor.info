// Mock for use-auto-track-repository hook in Storybook
import { fn } from "@storybook/test";

export const useAutoTrackRepository = fn(() => ({
  trackRepository: fn(),
  untrackRepository: fn(),
  isTracking: fn(() => false),
  loading: false
}));