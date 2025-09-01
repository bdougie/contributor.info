/**
 * Feature flags module
 * 
 * This module provides a comprehensive feature flag system integrated with PostHog
 * for controlled feature rollouts, A/B testing, and experimentation.
 * 
 * @example Basic usage:
 * ```tsx
 * import { FeatureFlag, FEATURE_FLAGS } from '@/lib/feature-flags';
 * 
 * function MyComponent() {
 *   return (
 *     <FeatureFlag flag={FEATURE_FLAGS.ENABLE_NEW_SEARCH}>
 *       <NewSearchComponent />
 *     </FeatureFlag>
 *   );
 * }
 * ```
 * 
 * @example A/B testing:
 * ```tsx
 * import { Experiment } from '@/lib/feature-flags';
 * 
 * function HomePage() {
 *   return (
 *     <Experiment
 *       name="new_homepage_design"
 *       control={<CurrentHomepage />}
 *       variants={{
 *         variant_a: <NewHomepage />,
 *         variant_b: <AlternativeHomepage />
 *       }}
 *     />
 *   );
 * }
 * ```
 */

// Export types
export type {
  FeatureFlagName,
  FeatureFlagValue,
  FeatureFlagResult,
  FeatureFlagConfig,
  ExperimentConfig,
  FeatureFlagsContextValue,
} from './types';

// Export constants
export { FEATURE_FLAGS } from './types';

// Export React context and hooks
export {
  FeatureFlagsProvider,
  useFeatureFlags,
  useFeatureFlag,
  useFeatureFlagValue,
  useExperiment,
} from './context';

// Export components
export {
  FeatureFlag,
  Experiment,
  FeatureGate,
  RolloutPercentage,
  FeatureFlagDebug,
} from './components';

// Export client for advanced usage
export { featureFlagClient, FEATURE_FLAG_CONFIGS } from './posthog-client';

// Export monitoring utilities
export { FeatureFlagMonitor } from './monitoring';

// Export utility functions
export { isFeatureFlagEnabled, getFeatureFlagValue, waitForFeatureFlag } from './utils';