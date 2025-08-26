// Mock for health components in Storybook
import { fn } from "@storybook/test";

export const RepositoryHealthOverall = (props: Record<string, unknown>) => 
  globalThis.React.createElement('div', { className: 'repository-health-overall', ...props }, 'Health Overall Mock');

export const RepositoryHealthFactors = (props: Record<string, unknown>) => 
  globalThis.React.createElement('div', { className: 'repository-health-factors', ...props }, 'Health Factors Mock');

export default (props: Record<string, unknown>) => 
  globalThis.React.createElement('div', { className: 'lottery-factor', ...props }, 'Lottery Factor Mock');

export const LotteryFactorContent = (props: Record<string, unknown>) => 
  globalThis.React.createElement('div', { className: 'lottery-factor-content', ...props }, 'Lottery Factor Content Mock');

export const ContributorConfidenceCard = (props: Record<string, unknown>) => 
  globalThis.React.createElement('div', { className: 'contributor-confidence-card', ...props }, 'Confidence Card Mock');

export const SelfSelectionRate = (props: Record<string, unknown>) => 
  globalThis.React.createElement('div', { className: 'self-selection-rate', ...props }, 'Self Selection Rate Mock');