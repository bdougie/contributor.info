/**
 * Workspace Events Service
 * Integrates GitHub events cache data to provide rich temporal metrics for workspaces
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { supabase } from '@/lib/supabase';

// Constants for configuration values
const WORKSPACE_CONFIG = {
  MAX_ACTIVITY_FEED_LIMIT: 1000,
  DEFAULT_ACTIVITY_FEED_LIMIT: 50,
  MAX_REPOSITORY_SUMMARIES_LIMIT: 1000,
  DEFAULT_REPOSITORY_SUMMARIES_LIMIT: 100,
  ACTIVITY_SCORE_MULTIPLIER: 10, // Converts daily average to activity score (0-100)
  MAX_ACTIVITY_SCORE: 100,
} as const;

// Types for Supabase query responses
interface WorkspaceRepositoryWithRepo {
  repositories: {
    owner: string;
    name: string;
    full_name: string;
  };
}

// Types for event-based metrics
export interface EventMetrics {
  stars: EventTrendMetrics;
  forks: EventTrendMetrics;
  activity: ActivityMetrics;
  timeline: TimelineDataPoint[];
}

export interface EventTrendMetrics {
  total: number;
  thisWeek: number;
  lastWeek: number;
  thisMonth: number;
  lastMonth: number;
  velocity: number; // events per day
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}

export interface ActivityMetrics {
  totalEvents: number;
  uniqueActors: number;
  mostActiveRepo: {
    owner: string;
    name: string;
    eventCount: number;
  } | null;
  activityScore: number; // 0-100 based on recent activity
}

export interface TimelineDataPoint {
  date: string;
  stars: number;
  forks: number;
  totalActivity: number;
}

export interface RepositoryEventSummary {
  repositoryOwner: string;
  repositoryName: string;
  starEvents: number;
  forkEvents: number;
  totalEvents: number;
  lastActivity: string;
  uniqueActors: number;
}

class WorkspaceEventsService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    this.supabase = supabase;
  }

  /**
   * Get event-based metrics for all repositories in a workspace
   */
  async getWorkspaceEventMetrics(
    workspaceId: string,
    timeRange: string = '30d'
  ): Promise<EventMetrics | null> {
    try {
      // Validate inputs
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('Invalid workspace ID provided');
      }

      if (!timeRange || typeof timeRange !== 'string') {
        throw new Error('Invalid time range provided');
      }

      // Calculate date ranges
      const now = new Date();
      const ranges = this.getDateRanges(timeRange, now);

      // Use the new database function to get velocity data
      const { data: velocityData, error: velocityError } = await this.supabase.rpc(
        'get_workspace_activity_velocity',
        {
          p_workspace_id: workspaceId,
          p_days: this.getTimeRangeDays(timeRange),
        }
      );

      if (velocityError) {
        throw new Error(
          `Failed to fetch workspace velocity data: ${velocityError.message || velocityError.code || 'Unknown database error'}`
        );
      }

      // Get aggregated metrics
      const { data: metricsData, error: metricsError } = await this.supabase.rpc(
        'get_workspace_event_metrics_aggregated',
        {
          p_workspace_id: workspaceId,
          p_start_date: ranges.currentStart.toISOString(),
          p_end_date: ranges.currentEnd.toISOString(),
        }
      );

      if (metricsError) {
        throw new Error(
          `Failed to fetch workspace metrics data: ${metricsError.message || metricsError.code || 'Unknown database error'}`
        );
      }

      const velocity = velocityData?.[0];
      const metrics = metricsData?.[0];

      if (!velocity || !metrics) {
        console.log('[WorkspaceEvents] No event data found for workspace:', workspaceId);
        return null;
      }

      // Process timeline data from the metrics
      let timeline: TimelineDataPoint[] = [];
      if (metrics.daily_timeline) {
        timeline = Array.isArray(metrics.daily_timeline)
          ? metrics.daily_timeline
          : [metrics.daily_timeline];
      }

      // Calculate trend for stars based on recent activity
      const trend = velocity.growth_trend as 'up' | 'down' | 'stable';

      const result: EventMetrics = {
        stars: {
          total: Number(metrics.total_star_events || 0),
          thisWeek: 0, // Could be calculated from timeline if needed
          lastWeek: 0,
          thisMonth: Number(metrics.total_star_events || 0),
          lastMonth: 0,
          velocity: Number(velocity.star_velocity || 0),
          trend,
          percentChange: 0, // Could be calculated with previous period comparison
        },
        forks: {
          total: Number(metrics.total_fork_events || 0),
          thisWeek: 0,
          lastWeek: 0,
          thisMonth: Number(metrics.total_fork_events || 0),
          lastMonth: 0,
          velocity: Number(velocity.fork_velocity || 0),
          trend,
          percentChange: 0,
        },
        activity: {
          totalEvents: Number(velocity.total_events || 0),
          uniqueActors: Number(metrics.unique_actors || 0),
          mostActiveRepo:
            metrics.most_active_repo_owner && metrics.most_active_repo_name
              ? {
                  owner: metrics.most_active_repo_owner,
                  name: metrics.most_active_repo_name,
                  eventCount: Number(metrics.most_active_repo_events || 0),
                }
              : null,
          activityScore: Math.min(
            WORKSPACE_CONFIG.MAX_ACTIVITY_SCORE,
            Math.round(
              Number(velocity.daily_average || 0) * WORKSPACE_CONFIG.ACTIVITY_SCORE_MULTIPLIER
            )
          ),
        },
        timeline: timeline.map((item) => ({
          date: String((item as Record<string, unknown>).date || ''),
          stars: Number((item as Record<string, unknown>).stars || 0),
          forks: Number((item as Record<string, unknown>).forks || 0),
          totalActivity: Number((item as Record<string, unknown>).total || 0),
        })),
      };

      console.log('[WorkspaceEvents] Final metrics result:', result);
      return result;
    } catch (error) {
      console.error('Error fetching workspace event metrics:', error);
      return null;
    }
  }

  /**
   * Get repository-level event summaries for a workspace
   */
  async getWorkspaceRepositoryEventSummaries(
    workspaceId: string,
    timeRange: string = '30d',
    options: { limit?: number; offset?: number } = {}
  ): Promise<RepositoryEventSummary[]> {
    try {
      // Validate inputs
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('Invalid workspace ID provided');
      }

      if (!timeRange || typeof timeRange !== 'string') {
        throw new Error('Invalid time range provided');
      }

      const { limit = WORKSPACE_CONFIG.DEFAULT_REPOSITORY_SUMMARIES_LIMIT, offset = 0 } = options;

      // Validate pagination parameters
      if (
        typeof limit !== 'number' ||
        limit <= 0 ||
        limit > WORKSPACE_CONFIG.MAX_REPOSITORY_SUMMARIES_LIMIT
      ) {
        throw new Error(
          `Invalid limit: must be a positive number between 1 and ${WORKSPACE_CONFIG.MAX_REPOSITORY_SUMMARIES_LIMIT}`
        );
      }

      if (typeof offset !== 'number' || offset < 0) {
        throw new Error('Invalid offset: must be a non-negative number');
      }

      const ranges = this.getDateRanges(timeRange, new Date());

      const { data, error } = await this.supabase.rpc('get_workspace_repository_event_summaries', {
        p_workspace_id: workspaceId,
        p_start_date: ranges.currentStart.toISOString(),
        p_end_date: ranges.currentEnd.toISOString(),
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        throw new Error(
          `Failed to fetch repository event summaries: ${error.message || error.code || 'Unknown database error'}`
        );
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching repository event summaries:', error);
      throw error; // Re-throw to allow caller to handle the error
    }
  }

  /**
   * Get recent activity feed for a workspace
   */
  async getWorkspaceActivityFeed(
    workspaceId: string,
    limit: number = WORKSPACE_CONFIG.DEFAULT_ACTIVITY_FEED_LIMIT
  ): Promise<
    Array<{
      id: string;
      event_id: string;
      event_type: string;
      actor_login: string;
      repository_owner: string;
      repository_name: string;
      created_at: string;
      payload: Record<string, unknown>;
    }>
  > {
    try {
      // Validate inputs
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('Invalid workspace ID provided');
      }

      if (
        typeof limit !== 'number' ||
        limit <= 0 ||
        limit > WORKSPACE_CONFIG.MAX_ACTIVITY_FEED_LIMIT
      ) {
        throw new Error(
          `Invalid limit: must be a positive number between 1 and ${WORKSPACE_CONFIG.MAX_ACTIVITY_FEED_LIMIT}`
        );
      }
      // Get repositories in workspace
      const { data: workspaceRepos, error: reposError } = await this.supabase
        .from('workspace_repositories')
        .select(
          `
          repositories!inner (owner, name)
        `
        )
        .eq('workspace_id', workspaceId);

      if (reposError) {
        throw new Error(
          `Failed to fetch workspace repositories: ${reposError.message || reposError.code || 'Unknown database error'}`
        );
      }

      if (!workspaceRepos?.length) {
        console.log(`[WorkspaceEvents] No repositories found for workspace: ${workspaceId}`);
        return [];
      }

      // Extract repository information - each workspace repo has a single repositories object
      const repoConditions = (workspaceRepos as unknown as WorkspaceRepositoryWithRepo[]).map(
        (wr) => wr.repositories
      );

      // Get all events for workspace repositories using multiple queries to avoid SQL injection
      // This is safer than string interpolation in OR conditions
      const eventPromises = repoConditions.map(async (repo) => {
        try {
          const { data, error } = await this.supabase
            .from('github_events_cache')
            .select('*')
            .eq('repository_owner', repo.owner)
            .eq('repository_name', repo.name)
            .in('event_type', ['WatchEvent', 'ForkEvent', 'PullRequestEvent', 'IssuesEvent'])
            .order('created_at', { ascending: false })
            .limit(Math.ceil(limit / repoConditions.length)); // Distribute limit across repos

          if (error) {
            console.warn(
              `Failed to fetch events for repository ${repo.owner}/${repo.name}:`,
              error
            );
            return [];
          }

          return data || [];
        } catch (err) {
          console.warn(`Error querying events for repository ${repo.owner}/${repo.name}:`, err);
          return [];
        }
      });

      const eventArrays = await Promise.allSettled(eventPromises);
      const successfulResults = eventArrays
        .filter(
          (result): result is PromiseFulfilledResult<unknown[]> => result.status === 'fulfilled'
        )
        .map((result) => result.value);

      if (eventArrays.some((result) => result.status === 'rejected')) {
        console.warn('[WorkspaceEvents] Some repository queries failed, returning partial results');
      }

      const allEvents = successfulResults.flat();

      // Sort and limit the combined results
      const events = allEvents
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);

      return events;
    } catch (error) {
      console.error('Error fetching workspace activity feed:', error);
      return [];
    }
  }

  /**
   * Private helper methods
   */
  private getDateRanges(timeRange: string, now: Date) {
    const ranges = {
      currentEnd: now,
      currentStart: new Date(),
      previousEnd: new Date(),
      previousStart: new Date(),
    };

    const days = this.getTimeRangeDays(timeRange);

    // Current period
    ranges.currentStart.setDate(now.getDate() - days);

    // Previous period (same duration, ending when current period starts)
    ranges.previousEnd = new Date(ranges.currentStart);
    ranges.previousStart.setDate(ranges.previousEnd.getDate() - days);

    return ranges;
  }

  private getTimeRangeDays(timeRange: string): number {
    switch (timeRange) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      case '1y':
        return 365;
      default:
        return 30;
    }
  }
}

export const workspaceEventsService = new WorkspaceEventsService();
