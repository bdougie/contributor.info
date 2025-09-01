/**
 * Feature flag utility functions
 */

import { featureFlagClient } from './posthog-client';
import type { FeatureFlagName, FeatureFlagValue } from './types';

/**
 * Check if a feature flag is enabled (for use outside React components)
 */
export async function isFeatureFlagEnabled(flagName: FeatureFlagName): Promise<boolean> {
  const result = await featureFlagClient.evaluateFlag(flagName);
  return result.enabled;
}

/**
 * Get a feature flag value (for use outside React components)
 */
export async function getFeatureFlagValue(flagName: FeatureFlagName): Promise<FeatureFlagValue> {
  const result = await featureFlagClient.evaluateFlag(flagName);
  return result.value;
}

/**
 * Wait for a feature flag to become enabled
 */
export async function waitForFeatureFlag(
  flagName: FeatureFlagName,
  options: {
    timeout?: number;
    checkInterval?: number;
  } = {}
): Promise<boolean> {
  const { timeout = 30000, checkInterval = 1000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const enabled = await isFeatureFlagEnabled(flagName);
    if (enabled) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  return false;
}

/**
 * Batch check multiple feature flags
 */
export async function checkFeatureFlags(
  flagNames: FeatureFlagName[]
): Promise<Map<FeatureFlagName, boolean>> {
  const results = new Map<FeatureFlagName, boolean>();
  
  await Promise.all(
    flagNames.map(async (flagName) => {
      const enabled = await isFeatureFlagEnabled(flagName);
      results.set(flagName, enabled);
    })
  );
  
  return results;
}

/**
 * Get all feature flag values
 */
export async function getAllFeatureFlags(): Promise<Map<FeatureFlagName, FeatureFlagValue>> {
  const { FEATURE_FLAGS } = await import('./types');
  const flags = Object.values(FEATURE_FLAGS) as FeatureFlagName[];
  const results = new Map<FeatureFlagName, FeatureFlagValue>();
  
  await Promise.all(
    flags.map(async (flagName) => {
      const value = await getFeatureFlagValue(flagName);
      results.set(flagName, value);
    })
  );
  
  return results;
}

/**
 * Format feature flag name for display
 */
export function formatFeatureFlagName(flagName: FeatureFlagName): string {
  return flagName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Parse feature flag from URL query parameters (for testing)
 */
export function parseFeatureFlagsFromUrl(): Map<FeatureFlagName, boolean> {
  const params = new URLSearchParams(window.location.search);
  const flags = new Map<FeatureFlagName, boolean>();
  
  params.forEach((value, key) => {
    if (key.startsWith('ff_')) {
      const flagName = key.substring(3) as FeatureFlagName;
      flags.set(flagName, value === 'true' || value === '1');
    }
  });
  
  return flags;
}

/**
 * Build URL with feature flag overrides (for testing)
 */
export function buildUrlWithFeatureFlags(
  baseUrl: string,
  flags: Partial<Record<FeatureFlagName, boolean>>
): string {
  const url = new URL(baseUrl);
  
  Object.entries(flags).forEach(([flagName, enabled]) => {
    if (enabled !== undefined) {
      url.searchParams.set(`ff_${flagName}`, enabled.toString());
    }
  });
  
  return url.toString();
}

/**
 * Create a feature flag override for testing
 */
export function createFeatureFlagOverride(
  flags: Partial<Record<FeatureFlagName, boolean>>
): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('[FeatureFlags] Overrides only work in development mode');
    return;
  }
  
  localStorage.setItem('feature_flag_overrides', JSON.stringify(flags));
  console.log('[FeatureFlags] Overrides set:', flags);
}

/**
 * Clear feature flag overrides
 */
export function clearFeatureFlagOverrides(): void {
  localStorage.removeItem('feature_flag_overrides');
  console.log('[FeatureFlags] Overrides cleared');
}

/**
 * Get current feature flag overrides
 */
export function getFeatureFlagOverrides(): Partial<Record<FeatureFlagName, boolean>> {
  const stored = localStorage.getItem('feature_flag_overrides');
  if (!stored) {
    return {};
  }
  
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}