/**
 * Feature flags React context and provider
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { featureFlagClient } from './posthog-client';
import type {
  FeatureFlagName,
  FeatureFlagValue,
  FeatureFlagResult,
  FeatureFlagsContextValue,
  ExperimentConfig,
} from './types';
import { FEATURE_FLAGS } from './types';

// Create context
const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

// Provider props
interface FeatureFlagsProviderProps {
  children: React.ReactNode;
  userId?: string;
  organizationId?: string;
}

/**
 * Feature flags provider component
 */
export function FeatureFlagsProvider({
  children,
  userId: propUserId,
  organizationId: propOrganizationId,
}: FeatureFlagsProviderProps) {
  const [flags, setFlags] = useState<Map<FeatureFlagName, FeatureFlagResult>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use prop values for user context
  const userId = propUserId || null;
  const organizationId = propOrganizationId || null;

  // Initialize PostHog client
  useEffect(() => {
    const initializeClient = async () => {
      try {
        setIsLoading(true);
        await featureFlagClient.initialize();
        featureFlagClient.setUserContext(userId, organizationId);
        await loadAllFlags();
      } catch (err) {
        console.error('[FeatureFlags] Error initializing:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize feature flags'));
      } finally {
        setIsLoading(false);
      }
    };

    initializeClient();
  }, [userId, organizationId]);

  // Load all feature flags
  const loadAllFlags = async () => {
    const newFlags = new Map<FeatureFlagName, FeatureFlagResult>();

    // Evaluate all defined flags
    for (const flagName of Object.values(FEATURE_FLAGS)) {
      try {
        const result = await featureFlagClient.evaluateFlag(flagName);
        newFlags.set(flagName, result);
      } catch (err) {
        console.error(`[FeatureFlags] Error evaluating flag ${flagName}:`, err);
        // Set default value on error
        newFlags.set(flagName, {
          enabled: false,
          value: false,
          reason: 'default',
        });
      }
    }

    setFlags(newFlags);
  };

  // Reload flags
  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      await featureFlagClient.reloadFlags();
      await loadAllFlags();
    } catch (err) {
      console.error('[FeatureFlags] Error reloading:', err);
      setError(err instanceof Error ? err : new Error('Failed to reload feature flags'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check if a flag is enabled
  const checkFlag = useCallback(
    (flagName: FeatureFlagName): boolean => {
      const result = flags.get(flagName);
      if (result) {
        // Track exposure
        featureFlagClient.trackFlagExposure(flagName, result.value);
        return result.enabled;
      }
      return false;
    },
    [flags]
  );

  // Get flag value
  const getFlagValue = useCallback(
    (flagName: FeatureFlagName): FeatureFlagValue => {
      const result = flags.get(flagName);
      if (result) {
        // Track exposure
        featureFlagClient.trackFlagExposure(flagName, result.value);
        return result.value;
      }
      return false;
    },
    [flags]
  );

  // Get experiment variant
  const getExperimentVariant = useCallback(
    async (experimentName: string): Promise<string | null> => {
      const experiment: ExperimentConfig = {
        name: experimentName,
        variants: ['control', 'variant'], // Default variants
        metrics: [],
        allocation: 100,
      };

      const variant = await featureFlagClient.getExperimentVariant(experiment);
      if (variant) {
        featureFlagClient.trackExperimentExposure(experimentName, variant);
      }
      return variant;
    },
    []
  );

  // Context value
  const contextValue = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags,
      isLoading,
      error,
      checkFlag,
      getFlagValue,
      getExperimentVariant: (name: string) => {
        // Convert async to sync for simpler API
        getExperimentVariant(name);
        return null; // Return null initially, component should handle async
      },
      reload,
    }),
    [flags, isLoading, error, checkFlag, getFlagValue, getExperimentVariant, reload]
  );

  return (
    <FeatureFlagsContext.Provider value={contextValue}>{children}</FeatureFlagsContext.Provider>
  );
}

/**
 * Hook to use feature flags
 */
export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }
  return context;
}

/**
 * Hook to check a specific feature flag
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const { checkFlag } = useFeatureFlags();
  return checkFlag(flagName);
}

/**
 * Hook to get a feature flag value
 */
export function useFeatureFlagValue(flagName: FeatureFlagName): FeatureFlagValue {
  const { getFlagValue } = useFeatureFlags();
  return getFlagValue(flagName);
}

/**
 * Hook for A/B testing
 */
export function useExperiment(experimentName: string, variants: string[] = ['control', 'variant']) {
  const [variant, setVariant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getVariant = async () => {
      try {
        setLoading(true);
        const experiment: ExperimentConfig = {
          name: experimentName,
          variants,
          metrics: [],
          allocation: 100,
        };
        const result = await featureFlagClient.getExperimentVariant(experiment);
        setVariant(result);
      } catch (error) {
        console.error(`[FeatureFlags] Error getting experiment variant:`, error);
        setVariant(variants[0]); // Default to control
      } finally {
        setLoading(false);
      }
    };

    getVariant();
  }, [experimentName, variants]);

  return { variant, loading };
}
