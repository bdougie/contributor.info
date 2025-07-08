// Mock for contribution-analyzer in Storybook
import { fn } from "@storybook/test";

export const ContributionAnalyzer = class {
  constructor() {}
  
  analyzeContributions = fn(() => ({
    topContributors: [],
    codeOwnership: {},
    riskFactors: []
  }));
  
  calculateMetrics = fn(() => ({
    diversity: 0.75,
    concentration: 0.25,
    riskLevel: 'low'
  }));
};