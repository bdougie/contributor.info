/**
 * Workspace Events Service
 * Integrates GitHub events cache data to provide rich temporal metrics for workspaces
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

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
    this.supabase = createSupabaseAdmin();
  }

  /**
   * Get event-based metrics for all repositories in a workspace
   */
  async getWorkspaceEventMetrics(
    workspaceId: string,
    timeRange: string = '30d'
  ): Promise<EventMetrics | null> {
    try {
      // Get repositories in the workspace
      const { data: workspaceRepos, error: repoError } = await this.supabase
        .from('workspace_repositories')
        .select(`
          repositories!inner (
            owner,
            name,
            full_name
          )
        `)
        .eq('workspace_id', workspaceId);

      if (repoError) throw repoError;
      if (!workspaceRepos?.length) return null;

      const repositories = workspaceRepos.map(wr => wr.repositories);
      const repoConditions = repositories.map(repo => ({
        repository_owner: repo.owner,
        repository_name: repo.name
      }));

      // Calculate date ranges
      const now = new Date();
      const ranges = this.getDateRanges(timeRange, now);

      // Get event data for all repositories
      const [currentPeriodEvents, previousPeriodEvents, timelineData] = await Promise.all([
        this.getEventsForPeriod(repoConditions, ranges.currentStart, ranges.currentEnd),
        this.getEventsForPeriod(repoConditions, ranges.previousStart, ranges.previousEnd),
        this.getTimelineData(repoConditions, ranges.currentStart, ranges.currentEnd)
      ]);

      // Process metrics
      const currentStars = currentPeriodEvents.filter(e => e.event_type === 'WatchEvent');
      const currentForks = currentPeriodEvents.filter(e => e.event_type === 'ForkEvent');
      const previousStars = previousPeriodEvents.filter(e => e.event_type === 'WatchEvent');
      const previousForks = previousPeriodEvents.filter(e => e.event_type === 'ForkEvent');

      // Calculate metrics
      const starMetrics = this.calculateTrendMetrics(currentStars, previousStars, ranges);
      const forkMetrics = this.calculateTrendMetrics(currentForks, previousForks, ranges);
      const activityMetrics = this.calculateActivityMetrics(currentPeriodEvents);
      const timeline = this.processTimelineData(timelineData);

      return {
        stars: starMetrics,
        forks: forkMetrics,
        activity: activityMetrics,
        timeline
      };

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
    timeRange: string = '30d'
  ): Promise<RepositoryEventSummary[]> {
    try {
      const ranges = this.getDateRanges(timeRange, new Date());

      const { data, error } = await this.supabase
        .rpc('get_workspace_repository_event_summaries', {
          p_workspace_id: workspaceId,
          p_start_date: ranges.currentStart.toISOString(),
          p_end_date: ranges.currentEnd.toISOString()
        });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error fetching repository event summaries:', error);
      return [];
    }
  }

  /**
   * Get recent activity feed for a workspace
   */
  async getWorkspaceActivityFeed(
    workspaceId: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    event_id: string;
    event_type: string;
    actor_login: string;
    repository_owner: string;
    repository_name: string;
    created_at: string;
    payload: Record<string, unknown>;
  }>> {
    try {
      // Get repositories in workspace
      const { data: workspaceRepos } = await this.supabase
        .from('workspace_repositories')
        .select(`
          repositories!inner (owner, name)
        `)
        .eq('workspace_id', workspaceId);

      if (!workspaceRepos?.length) return [];

      const repoConditions = workspaceRepos.map(wr => wr.repositories);
      
      // Build OR conditions for repositories
      const orConditions = repoConditions.map(repo => 
        `and(repository_owner.eq.${repo.owner},repository_name.eq.${repo.name})`
      ).join(',');

      const { data: events, error } = await this.supabase
        .from('github_events_cache')
        .select('*')
        .or(orConditions)
        .in('event_type', ['WatchEvent', 'ForkEvent', 'PullRequestEvent', 'IssuesEvent'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return events || [];

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
      previousStart: new Date()
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
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  }

  private async getEventsForPeriod(
    repoConditions: Array<{repository_owner: string; repository_name: string}>,
    startDate: Date,
    endDate: Date
  ) {
    if (repoConditions.length === 0) return [];

    const orConditions = repoConditions.map(repo => 
      `and(repository_owner.eq.${repo.repository_owner},repository_name.eq.${repo.repository_name})`
    ).join(',');

    const { data, error } = await this.supabase
      .from('github_events_cache')
      .select('*')
      .or(orConditions)
      .in('event_type', ['WatchEvent', 'ForkEvent'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  private async getTimelineData(
    repoConditions: Array<{repository_owner: string; repository_name: string}>,
    startDate: Date,
    endDate: Date
  ) {
    if (repoConditions.length === 0) return [];

    const orConditions = repoConditions.map(repo => 
      `and(repository_owner.eq.${repo.repository_owner},repository_name.eq.${repo.repository_name})`
    ).join(',');

    const { data, error } = await this.supabase
      .from('github_events_cache')
      .select('event_type, created_at, repository_owner, repository_name')
      .or(orConditions)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private calculateTrendMetrics(
    currentEvents: Array<{ created_at: string }>,
    previousEvents: Array<{ created_at: string }>,
    ranges: {
      currentStart: Date;
      currentEnd: Date;
      previousStart: Date;
      previousEnd: Date;
    }
  ): EventTrendMetrics {
    const currentCount = currentEvents.length;
    const previousCount = previousEvents.length;
    
    // Calculate velocity (events per day)
    const periodDays = Math.ceil((ranges.currentEnd - ranges.currentStart) / (1000 * 60 * 60 * 24));
    const velocity = currentCount / periodDays;
    
    // Calculate percent change
    let percentChange = 0;
    if (previousCount > 0) {
      percentChange = Math.round(((currentCount - previousCount) / previousCount) * 100);
    } else if (currentCount > 0) {
      percentChange = 100;
    }

    // Determine trend
    let trend: 'up' | 'down' | 'stable';
    if (percentChange > 5) {
      trend = 'up';
    } else if (percentChange < -5) {
      trend = 'down';
    } else {
      trend = 'stable';
    }

    // Calculate week/month breakdowns
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const thisWeek = currentEvents.filter(e => new Date(e.created_at) >= oneWeekAgo).length;
    const lastWeek = currentEvents.filter(e => {
      const date = new Date(e.created_at);
      return date >= twoWeeksAgo && date < oneWeekAgo;
    }).length;

    const thisMonth = currentEvents.filter(e => new Date(e.created_at) >= oneMonthAgo).length;
    const lastMonth = currentEvents.filter(e => {
      const date = new Date(e.created_at);
      return date >= twoMonthsAgo && date < oneMonthAgo;
    }).length;

    return {
      total: currentCount,
      thisWeek,
      lastWeek,
      thisMonth,
      lastMonth,
      velocity: Math.round(velocity * 100) / 100,
      trend,
      percentChange
    };
  }

  private calculateActivityMetrics(events: Array<{
    actor_login: string;
    repository_owner: string;
    repository_name: string;
    created_at: string;
  }>): ActivityMetrics {
    const uniqueActors = new Set(events.map(e => e.actor_login)).size;
    
    // Find most active repository
    const repoActivity = events.reduce((acc, event) => {
      const repoKey = `${event.repository_owner}/${event.repository_name}`;
      acc[repoKey] = (acc[repoKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostActiveRepo = Object.entries(repoActivity)
      .sort(([,a], [,b]) => b - a)[0];

    let mostActiveRepoData = null;
    if (mostActiveRepo) {
      const [fullName, eventCount] = mostActiveRepo;
      const [owner, name] = fullName.split('/');
      mostActiveRepoData = { owner, name, eventCount };
    }

    // Calculate activity score (0-100) based on recent activity
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentEvents = events.filter(e => new Date(e.created_at) >= oneDayAgo).length;
    const activityScore = Math.min(100, Math.round((recentEvents / Math.max(1, events.length)) * 100));

    return {
      totalEvents: events.length,
      uniqueActors,
      mostActiveRepo: mostActiveRepoData,
      activityScore
    };
  }

  private processTimelineData(events: Array<{
    created_at: string;
    event_type: string;
  }>): TimelineDataPoint[] {
    // Group events by date
    const dailyData = events.reduce((acc, event) => {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { stars: 0, forks: 0, totalActivity: 0 };
      }
      
      acc[date].totalActivity++;
      if (event.event_type === 'WatchEvent') acc[date].stars++;
      if (event.event_type === 'ForkEvent') acc[date].forks++;
      
      return acc;
    }, {} as Record<string, {stars: number; forks: number; totalActivity: number}>);

    // Convert to timeline array
    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        ...data
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const workspaceEventsService = new WorkspaceEventsService();