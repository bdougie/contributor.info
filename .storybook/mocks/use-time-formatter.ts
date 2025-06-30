// Mock for use-time-formatter hook in Storybook
import { fn } from "@storybook/test";

export const useTimeFormatter = fn(() => ({
  formatDuration: fn((hours) => `${hours}h`),
  formatDate: fn((date) => new Date(date).toLocaleDateString()),
  formatRelativeTime: fn((date) => "2 days ago")
}));