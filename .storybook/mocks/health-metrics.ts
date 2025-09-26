// Mock for health-metrics in Storybook
import { fn } from '@storybook/test';

export const calculateHealthMetrics = fn(() => ({
  overallScore: 85,
  factors: {
    lotteryFactor: { score: 80, value: 0.25 },
    reviewTurnaround: { score: 90, averageHours: 2.5 },
    deploymentFrequency: { score: 75, deploysPerWeek: 12 },
    busTruckFactor: { score: 85, criticalContributors: 3 },
  },
}));
