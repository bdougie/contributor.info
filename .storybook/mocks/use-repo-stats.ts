// Mock for use-repo-stats hook in Storybook
import { fn } from "@storybook/test";

export const useRepoStats = fn(() => ({
  stats: {
    totalPRs: 1500,
    openPRs: 45,
    mergedPRs: 1455,
    totalContributors: 120,
    avgMergeTime: 2.5
  },
  loading: false,
  error: null
}));