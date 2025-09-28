/**
 * PostHog Cohort Manager
 * Manages user cohort creation, updates, and tracking
 */

import { supabase } from '@/lib/supabase';
import { identifyUser, trackEvent } from '@/lib/posthog-lazy';

export interface CohortDefinition {
  id: string;
  name: string;
  description: string;
  conditions: CohortConditions;
  priority: number; // For determining primary cohort
}

export interface CohortConditions {
  events?: EventCondition[];
  properties?: PropertyCondition[];
  behavioral?: BehavioralCondition;
}

export interface EventCondition {
  eventName: string;
  operator: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
  value: number;
  timeWindow?: string; // e.g., '7d', '30d'
  properties?: Record<string, unknown>;
}

export interface PropertyCondition {
  key: string;
  type: 'person' | 'event';
  operator: 'eq' | 'neq' | 'contains' | 'date_after' | 'date_before';
  value: unknown;
}

export interface BehavioralCondition {
  type: 'performed_event' | 'not_performed_event';
  eventName?: string;
  timeWindow?: string;
}

// Define all cohorts
export const COHORT_DEFINITIONS: CohortDefinition[] = [
  {
    id: 'power_users',
    name: 'Power Users',
    description: 'Highly engaged users with workspaces and multiple repositories',
    priority: 1,
    conditions: {
      events: [
        {
          eventName: 'workspace_created',
          operator: 'gte',
          value: 1,
        },
        {
          eventName: 'repository_added_to_workspace',
          operator: 'gte',
          value: 3,
          timeWindow: '30d',
        },
      ],
    },
  },
  {
    id: 'new_users',
    name: 'New Users',
    description: 'Users in their first 30 days',
    priority: 2,
    conditions: {
      properties: [
        {
          key: 'signup_date',
          type: 'person',
          operator: 'date_after',
          value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
  },
  {
    id: 'active_searchers',
    name: 'Active Searchers',
    description: 'Users who frequently search for repositories',
    priority: 3,
    conditions: {
      events: [
        {
          eventName: 'repository_searched',
          operator: 'gte',
          value: 5,
          timeWindow: '7d',
        },
        {
          eventName: 'repository_selected_from_search',
          operator: 'gte',
          value: 2,
          timeWindow: '7d',
        },
      ],
    },
  },
  {
    id: 'workspace_power_users',
    name: 'Workspace Power Users',
    description: 'Users actively managing multiple repositories in workspaces',
    priority: 1,
    conditions: {
      events: [
        {
          eventName: 'workspace_created',
          operator: 'gte',
          value: 1,
        },
        {
          eventName: 'repository_added_to_workspace',
          operator: 'gte',
          value: 5,
        },
        {
          eventName: 'workspace_settings_modified',
          operator: 'gte',
          value: 1,
        },
      ],
    },
  },
  {
    id: 'repository_browsers',
    name: 'Repository Browsers',
    description: "Users who browse but haven't created workspaces",
    priority: 5,
    conditions: {
      events: [
        {
          eventName: 'repository_page_viewed',
          operator: 'gte',
          value: 3,
          timeWindow: '30d',
        },
        {
          eventName: 'workspace_created',
          operator: 'eq',
          value: 0,
        },
      ],
    },
  },
  {
    id: 'trending_users',
    name: 'Trending Discovery Users',
    description: 'Users who discover repositories through trending',
    priority: 4,
    conditions: {
      events: [
        {
          eventName: 'trending_page_interaction',
          operator: 'gte',
          value: 2,
          timeWindow: '7d',
          properties: {
            action: 'repository_clicked',
          },
        },
      ],
    },
  },
  {
    id: 'high_intent_no_workspace',
    name: 'High Intent Users',
    description: "Engaged users who haven't created workspaces yet",
    priority: 2,
    conditions: {
      events: [
        {
          eventName: 'repository_page_viewed',
          operator: 'gte',
          value: 10,
          timeWindow: '30d',
        },
        {
          eventName: 'repository_tab_switched',
          operator: 'gte',
          value: 5,
          timeWindow: '30d',
        },
        {
          eventName: 'workspace_created',
          operator: 'eq',
          value: 0,
        },
      ],
    },
  },
  {
    id: 'sharers',
    name: 'Content Sharers',
    description: 'Users who share content (potential advocates)',
    priority: 3,
    conditions: {
      events: [
        {
          eventName: 'share_action',
          operator: 'gte',
          value: 2,
        },
      ],
    },
  },
  {
    id: 'error_experiencers',
    name: 'Error Experiencers',
    description: 'Users who have encountered errors',
    priority: 6,
    conditions: {
      events: [
        {
          eventName: 'error_boundary_triggered',
          operator: 'gte',
          value: 1,
          timeWindow: '7d',
        },
      ],
    },
  },
  {
    id: 'dormant_users',
    name: 'Dormant Users',
    description: "Previously active users who haven't returned",
    priority: 7,
    conditions: {
      behavioral: {
        type: 'not_performed_event',
        timeWindow: '30d',
      },
    },
  },
];

/**
 * Cohort Manager Class
 */
export class CohortManager {
  private userEventCounts: Map<string, Map<string, number>> = new Map();
  private userProperties: Map<string, Record<string, unknown>> = new Map();
  private userCohorts: Map<string, Set<string>> = new Map();

  /**
   * Initialize cohort manager for a user
   */
  async initializeUser(userId: string): Promise<void> {
    try {
      // Load user's event history from database
      const eventHistory = await this.loadUserEventHistory(userId);
      const userProps = await this.loadUserProperties(userId);

      this.userEventCounts.set(userId, eventHistory);
      this.userProperties.set(userId, userProps);

      // Calculate initial cohorts
      const cohorts = await this.calculateUserCohorts(userId);
      this.userCohorts.set(userId, cohorts);

      // Update user properties in PostHog with cohort information
      await this.updateUserCohortsInPostHog(userId, cohorts);
    } catch (error) {
      console.error('Failed to initialize cohorts for user:', error);
    }
  }

  /**
   * Load user's event history from database
   */
  private async loadUserEventHistory(userId: string): Promise<Map<string, number>> {
    const eventCounts = new Map<string, number>();

    try {
      // Query recent events from your tracking system
      const { data: recentEvents } = await supabase
        .from('user_events')
        .select('event_name, count')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (recentEvents) {
        recentEvents.forEach((event) => {
          eventCounts.set(event.event_name, event.count);
        });
      }
    } catch (error) {
      console.error('Failed to load event history:', error);
    }

    return eventCounts;
  }

  /**
   * Load user properties from database
   */
  private async loadUserProperties(userId: string): Promise<Record<string, unknown>> {
    try {
      const { data: user } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (user) {
        return {
          signup_date: user.created_at,
          github_username: user.github_username,
          email: user.email,
          has_workspace: user.has_workspace || false,
        };
      }
    } catch (error) {
      console.error('Failed to load user properties:', error);
    }

    return {};
  }

  /**
   * Calculate which cohorts a user belongs to
   */
  async calculateUserCohorts(userId: string): Promise<Set<string>> {
    const cohorts = new Set<string>();
    const eventCounts = this.userEventCounts.get(userId) || new Map();
    const properties = this.userProperties.get(userId) || {};

    for (const cohortDef of COHORT_DEFINITIONS) {
      if (this.userMatchesCohort(cohortDef, eventCounts, properties)) {
        cohorts.add(cohortDef.id);
      }
    }

    return cohorts;
  }

  /**
   * Check if user matches cohort conditions
   */
  private userMatchesCohort(
    cohort: CohortDefinition,
    eventCounts: Map<string, number>,
    properties: Record<string, unknown>
  ): boolean {
    const { conditions } = cohort;

    // Check event conditions
    if (conditions.events) {
      for (const eventCondition of conditions.events) {
        const count = eventCounts.get(eventCondition.eventName) || 0;

        if (!this.evaluateOperator(count, eventCondition.operator, eventCondition.value)) {
          return false;
        }
      }
    }

    // Check property conditions
    if (conditions.properties) {
      for (const propCondition of conditions.properties) {
        const value = properties[propCondition.key];

        if (!this.evaluatePropertyCondition(value, propCondition)) {
          return false;
        }
      }
    }

    // Check behavioral conditions
    if (conditions.behavioral) {
      // This would require more complex time-based analysis
      // For now, return true if other conditions match
      return true;
    }

    return true;
  }

  /**
   * Evaluate numerical operators
   */
  private evaluateOperator(value: number, operator: string, target: number): boolean {
    switch (operator) {
      case 'gte':
        return value >= target;
      case 'lte':
        return value <= target;
      case 'eq':
        return value === target;
      case 'gt':
        return value > target;
      case 'lt':
        return value < target;
      default:
        return false;
    }
  }

  /**
   * Evaluate property conditions
   */
  private evaluatePropertyCondition(value: unknown, condition: PropertyCondition): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'date_after':
        return new Date(String(value)) > new Date(String(condition.value));
      case 'date_before':
        return new Date(String(value)) < new Date(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Update user's cohort information in PostHog
   */
  private async updateUserCohortsInPostHog(userId: string, cohorts: Set<string>): Promise<void> {
    const cohortArray = Array.from(cohorts);
    const primaryCohort = this.getPrimaryCohort(cohortArray);

    // Update user properties in PostHog
    await identifyUser(userId, {
      cohorts: cohortArray,
      primary_cohort: primaryCohort,
      cohort_count: cohortArray.length,
      last_cohort_update: new Date().toISOString(),
    });

    // Track cohort assignment event
    await trackEvent('cohort_assigned', {
      user_id: userId,
      cohorts: cohortArray,
      primary_cohort: primaryCohort,
    });
  }

  /**
   * Get the primary cohort based on priority
   */
  private getPrimaryCohort(cohortIds: string[]): string | null {
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
  }

  /**
   * Track an event and update cohorts if needed
   */
  async trackEventAndUpdateCohorts(
    userId: string,
    eventName: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    // Update event count
    const eventCounts = this.userEventCounts.get(userId) || new Map();
    const currentCount = eventCounts.get(eventName) || 0;
    eventCounts.set(eventName, currentCount + 1);
    this.userEventCounts.set(userId, eventCounts);

    // Track the event
    await trackEvent(eventName, {
      ...properties,
      user_cohorts: Array.from(this.userCohorts.get(userId) || []),
    });

    // Recalculate cohorts periodically (not on every event)
    if (Math.random() < 0.1) {
      // 10% chance to recalculate
      const newCohorts = await this.calculateUserCohorts(userId);
      const oldCohorts = this.userCohorts.get(userId) || new Set();

      // Check if cohorts changed
      if (!this.areSetsEqual(oldCohorts, newCohorts)) {
        this.userCohorts.set(userId, newCohorts);
        await this.updateUserCohortsInPostHog(userId, newCohorts);

        // Track cohort change
        await trackEvent('cohort_changed', {
          user_id: userId,
          old_cohorts: Array.from(oldCohorts),
          new_cohorts: Array.from(newCohorts),
        });
      }
    }
  }

  /**
   * Check if two sets are equal
   */
  private areSetsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  /**
   * Get user's current cohorts
   */
  getUserCohorts(userId: string): string[] {
    return Array.from(this.userCohorts.get(userId) || []);
  }

  /**
   * Check if user belongs to a specific cohort
   */
  isUserInCohort(userId: string, cohortId: string): boolean {
    const userCohorts = this.userCohorts.get(userId);
    return userCohorts ? userCohorts.has(cohortId) : false;
  }

  /**
   * Get cohort statistics
   */
  async getCohortStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};

    for (const cohortDef of COHORT_DEFINITIONS) {
      stats[cohortDef.id] = 0;
    }

    for (const [, cohorts] of this.userCohorts) {
      for (const cohortId of cohorts) {
        stats[cohortId] = (stats[cohortId] || 0) + 1;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const cohortManager = new CohortManager();
