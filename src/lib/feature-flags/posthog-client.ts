/**
 * PostHog feature flag client
 * Handles feature flag evaluation and A/B testing with PostHog
 */

import type { PostHog } from 'posthog-js';
import { env } from '../env';
import type {
  FeatureFlagName,
  FeatureFlagValue,
  FeatureFlagResult,
  FeatureFlagConfig,
  ExperimentConfig,
} from './types';
import { FEATURE_FLAGS } from './types';

// Default configurations for all feature flags
export const FEATURE_FLAG_CONFIGS: Record<FeatureFlagName, FeatureFlagConfig> = {
  // Infrastructure flags
  [FEATURE_FLAGS.ENABLE_NEW_SEARCH]: {
    name: FEATURE_FLAGS.ENABLE_NEW_SEARCH,
    defaultValue: false,
    description: 'Enable improved search algorithm with better relevance scoring',
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.ENABLE_WORKSPACE_ANALYTICS]: {
    name: FEATURE_FLAGS.ENABLE_WORKSPACE_ANALYTICS,
    defaultValue: false,
    description: 'Enable analytics dashboard in workspace view',
    rolloutPercentage: 10, // 10% rollout
  },
  [FEATURE_FLAGS.ENABLE_PERFORMANCE_OPTIMIZATIONS]: {
    name: FEATURE_FLAGS.ENABLE_PERFORMANCE_OPTIMIZATIONS,
    defaultValue: false,
    description: 'Enable performance optimizations including code splitting and lazy loading',
    rolloutPercentage: 50, // 50% rollout
  },

  // UI/UX Experiments
  [FEATURE_FLAGS.NEW_ONBOARDING_FLOW]: {
    name: FEATURE_FLAGS.NEW_ONBOARDING_FLOW,
    defaultValue: false,
    description: 'Test simplified onboarding experience',
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.REPOSITORY_CARD_REDESIGN]: {
    name: FEATURE_FLAGS.REPOSITORY_CARD_REDESIGN,
    defaultValue: false,
    description: 'A/B test new repository card design',
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.DARK_MODE_DEFAULT]: {
    name: FEATURE_FLAGS.DARK_MODE_DEFAULT,
    defaultValue: false,
    description: 'Test defaulting to dark mode for new users',
    rolloutPercentage: 0,
  },

  // Feature Gates
  [FEATURE_FLAGS.ENABLE_BULK_OPERATIONS]: {
    name: FEATURE_FLAGS.ENABLE_BULK_OPERATIONS,
    defaultValue: false,
    description: 'Enable bulk repository management operations',
    rolloutPercentage: 0,
    enabledForUsers: [], // Can add specific user IDs
  },
  [FEATURE_FLAGS.ENABLE_ADVANCED_FILTERS]: {
    name: FEATURE_FLAGS.ENABLE_ADVANCED_FILTERS,
    defaultValue: false,
    description: 'Progressive rollout of advanced filtering capabilities',
    rolloutPercentage: 25,
  },
  [FEATURE_FLAGS.ENABLE_EXPORT_FEATURES]: {
    name: FEATURE_FLAGS.ENABLE_EXPORT_FEATURES,
    defaultValue: false,
    description: 'Control data export capabilities',
    rolloutPercentage: 0,
    enabledForOrganizations: [], // Can add specific org IDs
  },
  [FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION]: {
    name: FEATURE_FLAGS.ENABLE_WORKSPACE_CREATION,
    defaultValue: false,
    description: 'Enable workspace creation functionality',
    rolloutPercentage: 0,
  },
};

/**
 * PostHog feature flag client class
 */
export class PostHogFeatureFlagClient {
  private posthog: PostHog | null = null;
  private cache: Map<string, FeatureFlagResult> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;
  private userId: string | null = null;
  private organizationId: string | null = null;

  /**
   * Initialize the client with PostHog instance
   */
  async initialize(): Promise<void> {
    // Dynamically import PostHog to keep bundle size small
    try {
      const { default: posthog } = await import('posthog-js');

      // Initialize PostHog with feature flags enabled
      posthog.init(env.POSTHOG_KEY!, {
        api_host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        autocapture: !env.DEV,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: true,
        // Enable feature flags
        advanced_disable_decide: false, // Enable feature flag evaluation
        disable_surveys: true,
        disable_compression: false,
        loaded: (ph) => {
          console.log('[FeatureFlags] PostHog initialized with feature flags enabled');
          this.posthog = ph;
        },
      });

      this.posthog = posthog;
    } catch (error) {
      console.error('[FeatureFlags] Failed to initialize PostHog:', error);
      // Continue with default values if PostHog fails
    }
  }

  /**
   * Set user context for personalized flags
   */
  setUserContext(userId: string | null, organizationId: string | null = null): void {
    this.userId = userId;
    this.organizationId = organizationId;
    this.clearCache(); // Clear cache when context changes

    // Identify user in PostHog
    if (this.posthog && userId) {
      this.posthog.identify(userId, {
        organization_id: organizationId,
      });
    }
  }

  /**
   * Evaluate a feature flag
   */
  async evaluateFlag(flagName: FeatureFlagName): Promise<FeatureFlagResult> {
    // Check cache first
    const cached = this.getCachedFlag(flagName);
    if (cached) {
      return cached;
    }

    const config = FEATURE_FLAG_CONFIGS[flagName];
    if (!config) {
      console.warn(`[FeatureFlags] Unknown flag: ${flagName}`);
      return {
        enabled: false,
        value: false,
        reason: 'default',
      };
    }

    // Check user/org overrides
    if (this.userId && config.enabledForUsers?.includes(this.userId)) {
      const result: FeatureFlagResult = {
        enabled: true,
        value: true,
        reason: 'user',
      };
      this.cacheFlag(flagName, result);
      return result;
    }

    if (this.organizationId && config.enabledForOrganizations?.includes(this.organizationId)) {
      const result: FeatureFlagResult = {
        enabled: true,
        value: true,
        reason: 'organization',
      };
      this.cacheFlag(flagName, result);
      return result;
    }

    // Try PostHog evaluation
    if (this.posthog) {
      try {
        const posthogValue = await this.posthog.getFeatureFlag(flagName);
        if (posthogValue !== undefined) {
          const result: FeatureFlagResult = {
            enabled: Boolean(posthogValue),
            value: posthogValue,
            reason: 'override',
          };
          this.cacheFlag(flagName, result);
          return result;
        }
      } catch (error) {
        console.error(`[FeatureFlags] Error evaluating flag ${flagName}:`, error);
      }
    }

    // Fall back to percentage rollout
    if (config.rolloutPercentage && config.rolloutPercentage > 0) {
      const enabled = this.isInRollout(flagName, config.rolloutPercentage);
      const result: FeatureFlagResult = {
        enabled,
        value: enabled,
        reason: 'rollout',
      };
      this.cacheFlag(flagName, result);
      return result;
    }

    // Use default value
    const result: FeatureFlagResult = {
      enabled: Boolean(config.defaultValue),
      value: config.defaultValue,
      reason: 'default',
    };
    this.cacheFlag(flagName, result);
    return result;
  }

  /**
   * Get experiment variant
   */
  async getExperimentVariant(experiment: ExperimentConfig): Promise<string | null> {
    // Check if user is in experiment allocation
    if (!this.isInRollout(experiment.name, experiment.allocation)) {
      return null;
    }

    // Try PostHog multivariate testing
    if (this.posthog) {
      try {
        const variant = await this.posthog.getFeatureFlag(experiment.name);
        if (variant && typeof variant === 'string' && experiment.variants.includes(variant)) {
          return variant;
        }
      } catch (error) {
        console.error(`[FeatureFlags] Error getting experiment variant ${experiment.name}:`, error);
      }
    }

    // Fall back to deterministic assignment
    const hash = this.hashString(`${experiment.name}-${this.userId || 'anonymous'}`);
    const index = hash % experiment.variants.length;
    return experiment.variants[index];
  }

  /**
   * Reload all feature flags
   */
  async reloadFlags(): Promise<void> {
    this.clearCache();

    if (this.posthog) {
      try {
        await this.posthog.reloadFeatureFlags();
        console.log('[FeatureFlags] Flags reloaded from PostHog');
      } catch (error) {
        console.error('[FeatureFlags] Error reloading flags:', error);
      }
    }
  }

  /**
   * Track feature flag exposure
   */
  trackFlagExposure(flagName: FeatureFlagName, value: FeatureFlagValue): void {
    if (this.posthog) {
      this.posthog.capture('$feature_flag_called', {
        $feature_flag: flagName,
        $feature_flag_value: value,
      });
    }
  }

  /**
   * Track experiment exposure
   */
  trackExperimentExposure(experimentName: string, variant: string): void {
    if (this.posthog) {
      this.posthog.capture('$experiment_started', {
        $experiment_name: experimentName,
        $variant: variant,
      });
    }
  }

  // Private methods

  private getCachedFlag(flagName: string): FeatureFlagResult | null {
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
      this.clearCache();
      return null;
    }
    return this.cache.get(flagName) || null;
  }

  private cacheFlag(flagName: string, result: FeatureFlagResult): void {
    this.cache.set(flagName, result);
    this.lastCacheUpdate = Date.now();
  }

  private clearCache(): void {
    this.cache.clear();
    this.lastCacheUpdate = 0;
  }

  private isInRollout(key: string, percentage: number): boolean {
    const identifier = this.userId || this.getAnonymousId();
    const hash = this.hashString(`${key}-${identifier}`);
    return hash % 100 < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getAnonymousId(): string {
    let id = localStorage.getItem('contributor_info_anonymous_id');
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('contributor_info_anonymous_id', id);
    }
    return id;
  }
}

// Singleton instance
export const featureFlagClient = new PostHogFeatureFlagClient();
