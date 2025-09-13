import { useCallback, useEffect, useState } from 'react';
import { useGitHubAuth } from './use-github-auth';
import {
  cohortManager,
  type CohortDefinition,
  COHORT_DEFINITIONS,
} from '@/lib/analytics/cohort-manager';
import { trackEvent } from '@/lib/posthog-lazy';

interface UseCohortReturn {
  userCohorts: string[];
  primaryCohort: string | null;
  isInCohort: (cohortId: string) => boolean;
  cohortDefinitions: CohortDefinition[];
  isLoading: boolean;
  refreshCohorts: () => Promise<void>;
}

/**
 * Hook to manage user cohorts and cohort-based features
 */
export function useCohorts(): UseCohortReturn {
  const { user } = useGitHubAuth();
  const [userCohorts, setUserCohorts] = useState<string[]>([]);
  const [primaryCohort, setPrimaryCohort] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize cohorts when user logs in
  useEffect(() => {
    const initializeCohorts = async () => {
      if (!user?.id) {
        setUserCohorts([]);
        setPrimaryCohort(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        await cohortManager.initializeUser(user.id);
        const cohorts = cohortManager.getUserCohorts(user.id);
        setUserCohorts(cohorts);

        // Determine primary cohort
        const primary = determinePrimaryCohort(cohorts);
        setPrimaryCohort(primary);

        // Track cohort initialization
        trackEvent('cohorts_initialized', {
          user_id: user.id,
          cohorts,
          primary_cohort: primary,
        });
      } catch (error) {
        console.error('Failed to initialize cohorts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeCohorts();
  }, [user?.id, determinePrimaryCohort]);

  /**
   * Determine the primary cohort based on priority
   */
  const determinePrimaryCohort = useCallback((cohortIds: string[]): string | null => {
    if (cohortIds.length === 0) return null;

    let primaryCohort: CohortDefinition | null = null;
    let highestPriority = Infinity;

    for (const cohortId of cohortIds) {
      const cohortDef = COHORT_DEFINITIONS.find((c) => c.id === cohortId);
      if (cohortDef && cohortDef.priority < highestPriority) {
        highestPriority = cohortDef.priority;
        primaryCohort = cohortDef;
      }
    }

    return primaryCohort?.id || cohortIds[0];
  }, []);

  /**
   * Check if user is in a specific cohort
   */
  const isInCohort = useCallback(
    (cohortId: string): boolean => {
      return userCohorts.includes(cohortId);
    },
    [userCohorts]
  );

  /**
   * Manually refresh cohorts
   */
  const refreshCohorts = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const newCohorts = await cohortManager.calculateUserCohorts(user.id);
      setUserCohorts(Array.from(newCohorts));

      const primary = determinePrimaryCohort(Array.from(newCohorts));
      setPrimaryCohort(primary);

      trackEvent('cohorts_refreshed', {
        user_id: user.id,
        cohorts: Array.from(newCohorts),
        primary_cohort: primary,
      });
    } catch (error) {
      console.error('Failed to refresh cohorts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, determinePrimaryCohort]);

  return {
    userCohorts,
    primaryCohort,
    isInCohort,
    cohortDefinitions: COHORT_DEFINITIONS,
    isLoading,
    refreshCohorts,
  };
}

/**
 * Hook to track events with cohort information
 */
export function useCohortTracking() {
  const { user } = useGitHubAuth();
  const { userCohorts, primaryCohort } = useCohorts();

  const trackWithCohorts = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      if (!user?.id) {
        // Still track for anonymous users
        trackEvent(eventName, properties);
        return;
      }

      // Add cohort information to all tracked events
      cohortManager.trackEventAndUpdateCohorts(user.id, eventName, {
        ...properties,
        user_cohorts: userCohorts,
        primary_cohort: primaryCohort,
      });
    },
    [user?.id, userCohorts, primaryCohort]
  );

  return { trackWithCohorts };
}

/**
 * Hook for cohort-based feature flags
 */
export function useCohortFeatureFlag(flagKey: string, cohortId: string): boolean {
  const { isInCohort } = useCohorts();
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Check if user is in the required cohort for this feature
    const enabled = isInCohort(cohortId);
    setIsEnabled(enabled);

    if (enabled) {
      trackEvent('cohort_feature_flag_enabled', {
        flag_key: flagKey,
        cohort_id: cohortId,
      });
    }
  }, [isInCohort, cohortId, flagKey]);

  return isEnabled;
}

/**
 * Hook for cohort-based A/B testing
 */
export function useCohortExperiment(experimentKey: string) {
  const { primaryCohort, userCohorts } = useCohorts();
  const [variant, setVariant] = useState<'control' | 'treatment'>('control');

  useEffect(() => {
    // Assign variant based on cohort
    // Power users and workspace users get treatment
    const treatmentCohorts = ['power_users', 'workspace_power_users', 'active_searchers'];
    const shouldGetTreatment = userCohorts.some((cohort) => treatmentCohorts.includes(cohort));

    const assignedVariant = shouldGetTreatment ? 'treatment' : 'control';
    setVariant(assignedVariant);

    trackEvent('cohort_experiment_assigned', {
      experiment_key: experimentKey,
      variant: assignedVariant,
      primary_cohort: primaryCohort,
      user_cohorts: userCohorts,
    });
  }, [experimentKey, primaryCohort, userCohorts]);

  return { variant };
}
