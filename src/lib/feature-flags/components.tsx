/**
 * Feature flag React components
 */

import React from 'react';
import { useFeatureFlag, useExperiment } from './context';
import type { FeatureFlagName } from './types';

/**
 * Props for FeatureFlag component
 */
interface FeatureFlagProps {
  flag: FeatureFlagName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on feature flag
 */
export function FeatureFlag({ flag, children, fallback = null }: FeatureFlagProps) {
  const isEnabled = useFeatureFlag(flag);

  return <>{isEnabled ? children : fallback}</>;
}

/**
 * Props for Experiment component
 */
interface ExperimentProps {
  name: string;
  control: React.ReactNode;
  variants: Record<string, React.ReactNode>;
  loading?: React.ReactNode;
}

/**
 * Component for A/B testing
 */
export function Experiment({ name, control, variants, loading = null }: ExperimentProps) {
  const variantKeys = ['control', ...Object.keys(variants)];
  const { variant, loading: isLoading } = useExperiment(name, variantKeys);

  if (isLoading) {
    return <>{loading}</>;
  }

  if (!variant || variant === 'control') {
    return <>{control}</>;
  }

  return <>{variants[variant] || control}</>;
}

/**
 * Props for FeatureGate component
 */
interface FeatureGateProps {
  flags: FeatureFlagName[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that requires multiple feature flags
 */
export function FeatureGate({
  flags,
  requireAll = true,
  children,
  fallback = null,
}: FeatureGateProps) {
  const enabledFlags = flags.map(useFeatureFlag);

  const isEnabled = requireAll ? enabledFlags.every(Boolean) : enabledFlags.some(Boolean);

  return <>{isEnabled ? children : fallback}</>;
}

/**
 * Props for RolloutPercentage component
 */
interface RolloutPercentageProps {
  percentage: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  seed?: string;
}

/**
 * Component for manual percentage-based rollout
 */
export function RolloutPercentage({
  percentage,
  children,
  fallback = null,
  seed = 'default',
}: RolloutPercentageProps) {
  // Generate stable hash based on seed
  const hash = seed.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);

  const isIncluded = Math.abs(hash) % 100 < percentage;

  return <>{isIncluded ? children : fallback}</>;
}

/**
 * Props for FeatureFlagDebug component
 */
interface FeatureFlagDebugProps {
  className?: string;
}

/**
 * Debug component to show feature flag states (development only)
 */
export function FeatureFlagDebug({ className }: FeatureFlagDebugProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isDevelopment) {
    return null;
  }

  // Use a static list to avoid circular dependency
  // This list should be kept in sync with FEATURE_FLAGS in types.ts
  const flags: FeatureFlagName[] = [
    'enable_new_search',
    'enable_workspace_analytics',
    'enable_performance_optimizations',
    'new_onboarding_flow',
    'repository_card_redesign',
    'dark_mode_default',
    'enable_bulk_operations',
    'enable_advanced_filters',
    'enable_export_features',
  ] as FeatureFlagName[];

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold mb-2">Feature Flags</h3>
      <div className="space-y-1">
        {flags.map((flag) => (
          <FeatureFlagDebugItem key={flag} flag={flag} />
        ))}
      </div>
    </div>
  );
}

function FeatureFlagDebugItem({ flag }: { flag: FeatureFlagName }) {
  const isEnabled = useFeatureFlag(flag);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
      <span className="font-mono">{flag}</span>
      <span className="text-gray-500">({isEnabled ? 'enabled' : 'disabled'})</span>
    </div>
  );
}
