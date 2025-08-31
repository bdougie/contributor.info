/**
 * Feature flag types and interfaces
 */

/**
 * Feature flag names - single source of truth for all flags
 */
export const FEATURE_FLAGS = {
  // Infrastructure flags
  ENABLE_NEW_SEARCH: 'enable_new_search',
  ENABLE_WORKSPACE_ANALYTICS: 'enable_workspace_analytics',
  ENABLE_PERFORMANCE_OPTIMIZATIONS: 'enable_performance_optimizations',
  
  // UI/UX Experiments
  NEW_ONBOARDING_FLOW: 'new_onboarding_flow',
  REPOSITORY_CARD_REDESIGN: 'repository_card_redesign',
  DARK_MODE_DEFAULT: 'dark_mode_default',
  
  // Feature Gates
  ENABLE_BULK_OPERATIONS: 'enable_bulk_operations',
  ENABLE_ADVANCED_FILTERS: 'enable_advanced_filters',
  ENABLE_EXPORT_FEATURES: 'enable_export_features',
} as const;

export type FeatureFlagName = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

/**
 * Feature flag value types
 */
export type FeatureFlagValue = boolean | string | number;

/**
 * Feature flag configuration
 */
export interface FeatureFlagConfig {
  name: FeatureFlagName;
  defaultValue: FeatureFlagValue;
  description: string;
  rolloutPercentage?: number;
  enabledForUsers?: string[];
  enabledForOrganizations?: string[];
}

/**
 * A/B test experiment configuration
 */
export interface ExperimentConfig {
  name: string;
  variants: string[];
  metrics: string[];
  allocation: number; // percentage of users
  startDate?: Date;
  endDate?: Date;
}

/**
 * Feature flag evaluation result
 */
export interface FeatureFlagResult {
  enabled: boolean;
  value: FeatureFlagValue;
  variant?: string;
  reason: 'default' | 'override' | 'rollout' | 'experiment' | 'user' | 'organization';
}

/**
 * Feature flags context value
 */
export interface FeatureFlagsContextValue {
  flags: Map<FeatureFlagName, FeatureFlagResult>;
  isLoading: boolean;
  error: Error | null;
  checkFlag: (flagName: FeatureFlagName) => boolean;
  getFlagValue: (flagName: FeatureFlagName) => FeatureFlagValue;
  getExperimentVariant: (experimentName: string) => string | null;
  reload: () => Promise<void>;
}