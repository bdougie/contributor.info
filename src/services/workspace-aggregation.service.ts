/**
 * Workspace Aggregation Service
 * Handles the aggregation of metrics across all repositories in a workspace
 */

import type {
  WorkspaceMetrics,
  MetricsTimeRange,
  MetricsContributor,
  ActivityDataPoint,
  LanguageDistribution,
} from '@/types/workspace';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { toDateOnlyString, toUTCTimestamp } from '../lib/utils/date-formatting';

// Type definitions for aggregation
type Repository = Database['public']['Tables']['repositories']['Row'];

// Type for PR/Issue with contributor data
interface ContributorJoin {
  username: string;
  avatar_url: string | null;
}

interface PRWithContributor {
  author_id: string;
  contributors: ContributorJoin | ContributorJoin[] | null;
}

interface IssueWithContributor {
  author_id: string;
  contributors: ContributorJoin | ContributorJoin[] | null;
}

interface AggregatedData {
  totalPRs: number;
  mergedPRs: number;
  openPRs: number;
  draftPRs: number;
  totalIssues: number;
  closedIssues: number;
  openIssues: number;
  totalCommits: number;
  totalStars: number;
  totalForks: number;
  totalWatchers: number;
  prMergeTimes: number[];
  issueCloseTimes: number[];
  languages: LanguageDistribution;
  contributors: Map<string, MetricsContributor>;
  activityByDate: Map<string, ActivityDataPoint>;
  repositoryStats: RepositoryStat[];
}

interface TrendsData {
  starsTrend: number;
  prsTrend: number;
  contributorsTrend: number;
  issuesTrend: number;
}

interface CachedMetrics {
  id?: string;
  workspace_id: string;
  time_range: MetricsTimeRange;
  period_start: string;
  period_end: string;
  total_prs: number;
  merged_prs: number;
  open_prs: number;
  draft_prs: number;
  total_issues: number;
  closed_issues: number;
  open_issues: number;
  total_commits: number;
  total_stars: number;
  total_forks: number;
  total_watchers: number;
  total_contributors: number;
  active_contributors: number;
  new_contributors: number;
  avg_pr_merge_time_hours: number;
  avg_issue_close_time_hours?: number;
  pr_velocity: number;
  issue_closure_rate: number;
  top_contributors: MetricsContributor[];
  activity_timeline: ActivityDataPoint[];
  languages: LanguageDistribution;
  repository_stats: RepositoryStat[];
  stars_trend?: number;
  prs_trend?: number;
  contributors_trend?: number;
  issues_trend?: number;
  commits_trend?: number;
  cached_at: string;
  calculated_at?: string;
  expires_at?: string;
  is_stale?: boolean;
}

export interface AggregationOptions {
  timeRange: MetricsTimeRange;
  forceRefresh?: boolean;
  includeRepositoryStats?: boolean;
}

export interface RepositoryStat {
  repository_id: string;
  full_name: string;
  prs: number;
  issues: number;
  stars: number;
  contributors: number;
}

export interface AggregationResult {
  metrics: WorkspaceMetrics;
  cacheHit: boolean;
  calculationTimeMs: number;
  githubApiCalls: number;
}

export class WorkspaceAggregationService {
  private supabase: SupabaseClient | null = null;
  private githubApiCalls = 0;

  constructor() {
    // Initialize supabase client in constructor
    if (typeof window === 'undefined') {
      this.supabase = createSupabaseAdmin();
    }
  }

  /**
   * Main entry point for workspace metric aggregation
   */
  async aggregateWorkspaceMetrics(
    workspaceId: string,
    options: AggregationOptions
  ): Promise<AggregationResult> {
    const startTime = performance.now();
    this.githubApiCalls = 0;

    try {
      // Check cache first unless force refresh is requested
      if (!options.forceRefresh) {
        const cachedMetrics = await this.getCachedMetrics(workspaceId, options.timeRange);
        if (cachedMetrics && !cachedMetrics.is_stale) {
          return {
            metrics: this.transformCacheToMetrics(cachedMetrics),
            cacheHit: true,
            calculationTimeMs: performance.now() - startTime,
            githubApiCalls: 0,
          };
        }
      }

      // Get workspace repositories
      const repositories = await this.getWorkspaceRepositories(workspaceId);
      if (repositories.length === 0) {
        return this.createEmptyMetrics(workspaceId, options.timeRange, startTime);
      }

      // Calculate time period
      const { periodStart, periodEnd } = this.calculatePeriod(options.timeRange);

      // Aggregate metrics from all repositories
      const aggregatedData = await this.aggregateRepositoryData(
        repositories,
        periodStart,
        periodEnd,
        options
      );

      // Calculate trends vs previous period
      const trends = await this.calculateTrends(
        workspaceId,
        options.timeRange,
        aggregatedData,
        periodStart
      );

      // Build final metrics object
      const metrics = this.buildMetricsObject(
        workspaceId,
        options.timeRange,
        periodStart,
        periodEnd,
        aggregatedData,
        trends
      );

      // Save to cache
      await this.saveToCache(
        workspaceId,
        options.timeRange,
        metrics,
        performance.now() - startTime
      );

      // Queue history update for trend tracking
      await this.queueHistoryUpdate(workspaceId, aggregatedData);

      return {
        metrics,
        cacheHit: false,
        calculationTimeMs: performance.now() - startTime,
        githubApiCalls: this.githubApiCalls,
      };
    } catch (error) {
      console.error('Failed to aggregate workspace metrics:', error);
      throw error;
    }
  }

  /**
   * Get cached metrics from database
   */
  private async getCachedMetrics(workspaceId: string, timeRange: MetricsTimeRange) {
    const { data, error } = await this.supabase!.from('workspace_metrics_cache')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('time_range', timeRange)
      .maybeSingle();

    if (error) {
      console.error('Error fetching cached metrics:', error);
      return null;
    }

    // Check if cache is expired
    if (data && new Date(data.expires_at) < new Date()) {
      // Mark as stale but still return it (stale-while-revalidate)
      await this.markCacheAsStale(workspaceId);
      data.is_stale = true;
    }

    return data;
  }

  /**
   * Get all repositories in a workspace
   */
  private async getWorkspaceRepositories(workspaceId: string): Promise<Repository[]> {
    const { data, error } = await this.supabase!.from('workspace_repositories')
      .select(
        `
        repository_id,
        repositories (*)
      `
      )
      .eq('workspace_id', workspaceId);

    if (error) {
      throw new Error(`Failed to fetch workspace repositories: ${error.message}`);
    }

    // Extract and type the repositories properly
    const repositories = data?.map((wr) => wr.repositories).filter(Boolean) || [];
    return repositories as unknown as Repository[];
  }

  /**
   * Calculate period dates based on time range
   */
  private calculatePeriod(timeRange: MetricsTimeRange) {
    const periodEnd = new Date();
    const periodStart = new Date();

    switch (timeRange) {
      case '7d':
        periodStart.setDate(periodEnd.getDate() - 7);
        break;
      case '30d':
        periodStart.setDate(periodEnd.getDate() - 30);
        break;
      case '90d':
        periodStart.setDate(periodEnd.getDate() - 90);
        break;
      case '1y':
        periodStart.setFullYear(periodEnd.getFullYear() - 1);
        break;
      case 'all':
        periodStart.setFullYear(2008); // GitHub founding year
        break;
    }

    return { periodStart, periodEnd };
  }

  /**
   * Aggregate data from all repositories
   */
  private async aggregateRepositoryData(
    repositories: Repository[],
    periodStart: Date,
    periodEnd: Date,
    options: AggregationOptions
  ): Promise<AggregatedData> {
    const aggregated = {
      totalPRs: 0,
      mergedPRs: 0,
      openPRs: 0,
      draftPRs: 0,
      totalIssues: 0,
      closedIssues: 0,
      openIssues: 0,
      totalCommits: 0,
      totalStars: 0,
      totalForks: 0,
      totalWatchers: 0,
      prMergeTimes: [] as number[],
      issueCloseTimes: [] as number[],
      languages: {} as LanguageDistribution,
      contributors: new Map<string, MetricsContributor>(),
      activityByDate: new Map<string, ActivityDataPoint>(),
      repositoryStats: [] as RepositoryStat[],
    };

    // Process each repository in parallel (with concurrency limit)
    const batchSize = 3; // Process 3 repos at a time to avoid rate limits
    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      await Promise.all(
        batch.map((repo) =>
          this.processRepository(repo, periodStart, periodEnd, aggregated, options)
        )
      );
    }

    return aggregated;
  }

  /**
   * Process a single repository's metrics
   */
  private async processRepository(
    repository: Repository,
    periodStart: Date,
    periodEnd: Date,
    aggregated: AggregatedData,
    options: AggregationOptions
  ) {
    const repoFullName = repository.full_name;

    // Get PR data from database
    const prData = await this.getPullRequestData(repository.id, periodStart, periodEnd);

    // Get issue data from database
    const issueData = await this.getIssueData(repository.id, periodStart, periodEnd);

    // Get contributor data
    const contributorData = await this.getContributorData(repository.id, periodStart, periodEnd);

    // Update aggregated totals
    aggregated.totalPRs += prData.total;
    aggregated.mergedPRs += prData.merged;
    aggregated.openPRs += prData.open;
    aggregated.draftPRs += prData.draft;
    aggregated.prMergeTimes.push(...prData.mergeTimes);

    aggregated.totalIssues += issueData.total;
    aggregated.closedIssues += issueData.closed;
    aggregated.openIssues += issueData.open;
    aggregated.issueCloseTimes.push(...issueData.closeTimes);

    aggregated.totalStars += repository.stargazers_count || 0;
    aggregated.totalForks += repository.forks_count || 0;

    // Update language distribution
    if (repository.language) {
      aggregated.languages[repository.language] =
        (aggregated.languages[repository.language] || 0) + 1;
    }

    // Merge contributor data
    contributorData.forEach((contributor) => {
      const existing = aggregated.contributors.get(contributor.username) || {
        username: contributor.username,
        avatar_url: contributor.avatar_url,
        prs: 0,
        issues: 0,
        commits: 0,
        reviews: 0,
      };

      existing.prs += contributor.prs;
      existing.issues += contributor.issues;
      existing.commits += contributor.commits;
      existing.reviews += contributor.reviews;

      aggregated.contributors.set(contributor.username, existing);
    });

    // Add repository stats if requested
    if (options.includeRepositoryStats) {
      aggregated.repositoryStats.push({
        repository_id: repository.id,
        full_name: repoFullName,
        prs: prData.total,
        issues: issueData.total,
        stars: repository.stargazers_count || 0,
        contributors: contributorData.length,
      });
    }
  }

  /**
   * Get pull request data from database
   */
  private async getPullRequestData(repositoryId: string, periodStart: Date, periodEnd: Date) {
    const { data, error } = await this.supabase!.from('pull_requests')
      .select('state, draft, created_at, merged_at')
      .eq('repository_id', repositoryId)
      .gte('created_at', toUTCTimestamp(periodStart))
      .lte('created_at', toUTCTimestamp(periodEnd));

    if (error) {
      console.error('Error fetching PR data:', error);
      return { total: 0, merged: 0, open: 0, draft: 0, mergeTimes: [] };
    }

    const mergeTimes: number[] = [];
    let merged = 0;
    let open = 0;
    let draft = 0;

    data?.forEach((pr) => {
      if (pr.state === 'merged' && pr.merged_at && pr.created_at) {
        merged++;
        const mergeTime = new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime();
        mergeTimes.push(mergeTime / (1000 * 60 * 60)); // Convert to hours
      } else if (pr.state === 'open') {
        open++;
        if (pr.draft) draft++;
      }
    });

    return {
      total: data?.length || 0,
      merged,
      open,
      draft,
      mergeTimes,
    };
  }

  /**
   * Get issue data from database
   */
  private async getIssueData(repositoryId: string, periodStart: Date, periodEnd: Date) {
    const { data, error } = await this.supabase!.from('issues')
      .select('state, created_at, closed_at')
      .eq('repository_id', repositoryId)
      .gte('created_at', toUTCTimestamp(periodStart))
      .lte('created_at', toUTCTimestamp(periodEnd));

    if (error) {
      console.error('Error fetching issue data:', error);
      return { total: 0, closed: 0, open: 0, closeTimes: [] };
    }

    const closeTimes: number[] = [];
    let closed = 0;
    let open = 0;

    data?.forEach((issue) => {
      if (issue.state === 'closed' && issue.closed_at && issue.created_at) {
        closed++;
        const closeTime =
          new Date(issue.closed_at).getTime() - new Date(issue.created_at).getTime();
        closeTimes.push(closeTime / (1000 * 60 * 60)); // Convert to hours
      } else if (issue.state === 'open') {
        open++;
      }
    });

    return {
      total: data?.length || 0,
      closed,
      open,
      closeTimes,
    };
  }

  /**
   * Get contributor data from database
   */
  private async getContributorData(
    repositoryId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<MetricsContributor[]> {
    // Get PR contributors
    const { data: prContributors } = await this.supabase!.from('pull_requests')
      .select(
        `
        author_id,
        contributors!author_id (
          username,
          avatar_url
        )
      `
      )
      .eq('repository_id', repositoryId)
      .gte('created_at', toUTCTimestamp(periodStart))
      .lte('created_at', toUTCTimestamp(periodEnd));

    // Get issue contributors
    const { data: issueContributors } = await this.supabase!.from('issues')
      .select(
        `
        author_id,
        contributors!author_id (
          username,
          avatar_url
        )
      `
      )
      .eq('repository_id', repositoryId)
      .gte('created_at', toUTCTimestamp(periodStart))
      .lte('created_at', toUTCTimestamp(periodEnd));

    // Aggregate contributor stats
    const contributorMap = new Map<string, MetricsContributor>();

    prContributors?.forEach((pr: PRWithContributor) => {
      let contributors: ContributorJoin[] = [];
      if (Array.isArray(pr.contributors)) {
        contributors = pr.contributors;
      } else if (pr.contributors) {
        contributors = [pr.contributors];
      }

      contributors.forEach((contributor) => {
        if (contributor && contributor.username) {
          const existing = contributorMap.get(contributor.username) || {
            username: contributor.username,
            avatar_url: contributor.avatar_url || '',
            prs: 0,
            issues: 0,
            commits: 0,
            reviews: 0,
          };
          existing.prs++;
          contributorMap.set(contributor.username, existing);
        }
      });
    });

    issueContributors?.forEach((issue: IssueWithContributor) => {
      let contributors: ContributorJoin[] = [];
      if (Array.isArray(issue.contributors)) {
        contributors = issue.contributors;
      } else if (issue.contributors) {
        contributors = [issue.contributors];
      }

      contributors.forEach((contributor) => {
        if (contributor && contributor.username) {
          const existing = contributorMap.get(contributor.username) || {
            username: contributor.username,
            avatar_url: contributor.avatar_url || '',
            prs: 0,
            issues: 0,
            commits: 0,
            reviews: 0,
          };
          existing.issues++;
          contributorMap.set(contributor.username, existing);
        }
      });
    });

    return Array.from(contributorMap.values());
  }

  /**
   * Calculate trends vs previous period
   */
  private async calculateTrends(
    workspaceId: string,
    timeRange: MetricsTimeRange,
    currentData: AggregatedData,
    periodStart: Date
  ) {
    // Get previous period data for comparison
    const previousPeriod = await this.getPreviousPeriodMetrics(workspaceId, timeRange, periodStart);

    return {
      starsTrend: this.calculateTrendPercentage(
        currentData.totalStars,
        previousPeriod?.totalStars || 0
      ),
      prsTrend: this.calculateTrendPercentage(currentData.totalPRs, previousPeriod?.totalPRs || 0),
      contributorsTrend: this.calculateTrendPercentage(
        currentData.contributors.size,
        previousPeriod?.totalContributors || 0
      ),
      commitsTrend: this.calculateTrendPercentage(
        currentData.totalCommits,
        previousPeriod?.totalCommits || 0
      ),
      issuesTrend: this.calculateTrendPercentage(
        currentData.totalIssues,
        previousPeriod?.totalIssues || 0
      ),
    };
  }

  /**
   * Calculate trend percentage
   */
  private calculateTrendPercentage(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * Get metrics from previous period for trend calculation
   */
  private async getPreviousPeriodMetrics(
    workspaceId: string,
    timeRange: MetricsTimeRange,
    currentPeriodStart: Date
  ) {
    // Calculate previous period dates
    const periodLengthMs = this.getTimeRangeDuration(timeRange);
    const previousStart = new Date(currentPeriodStart.getTime() - periodLengthMs);
    const previousEnd = new Date(currentPeriodStart.getTime());

    // Query historical metrics
    const { data } = await this.supabase!.from('workspace_metrics_history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('metric_date', toDateOnlyString(previousStart))
      .lt('metric_date', toDateOnlyString(previousEnd));

    if (!data || data.length === 0) return null;

    // Aggregate historical data
    return data.reduce(
      (acc, day) => ({
        totalPRs: acc.totalPRs + (day.daily_prs || 0),
        totalStars: Math.max(acc.totalStars, day.total_stars || 0),
        totalContributors: Math.max(acc.totalContributors, day.total_contributors || 0),
        totalCommits: acc.totalCommits + (day.daily_commits || 0),
      }),
      {
        totalPRs: 0,
        totalStars: 0,
        totalContributors: 0,
        totalCommits: 0,
      }
    );
  }

  /**
   * Get time range duration in milliseconds
   */
  private getTimeRangeDuration(timeRange: MetricsTimeRange): number {
    switch (timeRange) {
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return 30 * 24 * 60 * 60 * 1000;
      case '90d':
        return 90 * 24 * 60 * 60 * 1000;
      case '1y':
        return 365 * 24 * 60 * 60 * 1000;
      case 'all':
        return 10 * 365 * 24 * 60 * 60 * 1000; // 10 years
    }
  }

  /**
   * Build the final metrics object
   */
  private buildMetricsObject(
    workspaceId: string,
    timeRange: MetricsTimeRange,
    periodStart: Date,
    periodEnd: Date,
    aggregatedData: AggregatedData,
    trends: TrendsData
  ): WorkspaceMetrics {
    // Calculate averages
    const avgPRMergeTime =
      aggregatedData.prMergeTimes.length > 0
        ? aggregatedData.prMergeTimes.reduce((a: number, b: number) => a + b, 0) /
          aggregatedData.prMergeTimes.length
        : 0;

    // avg_issue_close_time_hours is calculated but not used in current metrics
    // Keeping for future use when added to WorkspaceMetrics type
    // const avgIssueCloseTime =
    //   aggregatedData.issueCloseTimes.length > 0
    //     ? aggregatedData.issueCloseTimes.reduce((a: number, b: number) => a + b, 0) /
    //       aggregatedData.issueCloseTimes.length
    //     : 0;

    // Calculate velocities
    const daysDiff = Math.max(
      1,
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const prVelocity = aggregatedData.totalPRs / daysDiff;
    const issueClosureRate =
      aggregatedData.totalIssues > 0
        ? (aggregatedData.closedIssues / aggregatedData.totalIssues) * 100
        : 0;

    // Get top contributors (sorted by total contributions)
    const contributorValues = Array.from(
      aggregatedData.contributors.values()
    ) as MetricsContributor[];
    const topContributors = contributorValues
      .sort(
        (a: MetricsContributor, b: MetricsContributor) =>
          b.prs + b.issues + b.commits - (a.prs + a.issues + a.commits)
      )
      .slice(0, 10);

    // Build activity timeline
    const activityTimeline = this.buildActivityTimeline(
      aggregatedData.activityByDate,
      periodStart,
      periodEnd
    );

    return {
      id: `${workspaceId}-${timeRange}-${Date.now()}`,
      workspace_id: workspaceId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      time_range: timeRange,
      metrics: {
        total_prs: aggregatedData.totalPRs,
        merged_prs: aggregatedData.mergedPRs,
        open_prs: aggregatedData.openPRs,
        draft_prs: aggregatedData.draftPRs,
        total_issues: aggregatedData.totalIssues,
        closed_issues: aggregatedData.closedIssues,
        open_issues: aggregatedData.openIssues,
        total_contributors: aggregatedData.contributors.size,
        active_contributors: topContributors.length,
        new_contributors: 0, // Will be calculated from history
        total_commits: aggregatedData.totalCommits,
        total_stars: aggregatedData.totalStars,
        total_forks: aggregatedData.totalForks,
        total_watchers: aggregatedData.totalWatchers,
        avg_pr_merge_time_hours: avgPRMergeTime,
        pr_velocity: prVelocity,
        issue_closure_rate: issueClosureRate,
        languages: aggregatedData.languages,
        top_contributors: topContributors as MetricsContributor[],
        activity_timeline: activityTimeline,
        repository_stats: aggregatedData.repositoryStats,
        stars_trend: trends.starsTrend,
        prs_trend: trends.prsTrend,
        contributors_trend: trends.contributorsTrend,
        issues_trend: trends.issuesTrend,
      },
      calculated_at: new Date().toISOString(),
      expires_at: this.calculateExpiryTime(timeRange).toISOString(),
      is_stale: false,
    };
  }

  /**
   * Build activity timeline for charts
   */
  private buildActivityTimeline(
    activityMap: Map<string, ActivityDataPoint>,
    periodStart: Date,
    periodEnd: Date
  ): ActivityDataPoint[] {
    const timeline: ActivityDataPoint[] = [];
    const currentDate = new Date(periodStart);

    while (currentDate <= periodEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const activity = activityMap.get(dateStr) || {
        date: dateStr,
        prs: 0,
        issues: 0,
        commits: 0,
        contributors: 0,
      };
      timeline.push(activity);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return timeline;
  }

  /**
   * Calculate cache expiry time based on time range
   */
  private calculateExpiryTime(timeRange: MetricsTimeRange): Date {
    const now = new Date();
    switch (timeRange) {
      case '7d':
        return new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
      case '30d':
        return new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
      case '90d':
        return new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
      case '1y':
        return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      case 'all':
        return new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    }
  }

  /**
   * Save metrics to cache
   */
  private async saveToCache(
    workspaceId: string,
    timeRange: MetricsTimeRange,
    metrics: WorkspaceMetrics,
    calculationTimeMs: number
  ) {
    const cacheData = {
      workspace_id: workspaceId,
      time_range: timeRange,
      period_start: metrics.period_start,
      period_end: metrics.period_end,
      ...this.flattenMetricsForCache(metrics),
      calculated_at: metrics.calculated_at,
      expires_at: metrics.expires_at,
      is_stale: false,
      calculation_time_ms: Math.round(calculationTimeMs),
      github_api_calls: this.githubApiCalls,
      cache_version: 1,
    };

    const { error } = await this.supabase!.from('workspace_metrics_cache').upsert(cacheData, {
      onConflict: 'workspace_id,time_range',
    });

    if (error) {
      console.error('Failed to save metrics to cache:', error);
    }
  }

  /**
   * Flatten metrics object for database storage
   */
  private flattenMetricsForCache(metrics: WorkspaceMetrics) {
    return {
      total_prs: metrics.metrics.total_prs,
      merged_prs: metrics.metrics.merged_prs,
      open_prs: metrics.metrics.open_prs,
      draft_prs: metrics.metrics.draft_prs,
      avg_pr_merge_time_hours: metrics.metrics.avg_pr_merge_time_hours,
      pr_velocity: metrics.metrics.pr_velocity,
      total_issues: metrics.metrics.total_issues,
      closed_issues: metrics.metrics.closed_issues,
      open_issues: metrics.metrics.open_issues,
      avg_issue_close_time_hours: 0, // Not in WorkspaceMetrics yet
      issue_closure_rate: metrics.metrics.issue_closure_rate,
      total_contributors: metrics.metrics.total_contributors,
      active_contributors: metrics.metrics.active_contributors,
      new_contributors: metrics.metrics.new_contributors,
      total_commits: metrics.metrics.total_commits,
      total_stars: metrics.metrics.total_stars,
      total_forks: metrics.metrics.total_forks,
      total_watchers: metrics.metrics.total_watchers,
      languages: metrics.metrics.languages,
      top_contributors: metrics.metrics.top_contributors,
      activity_timeline: metrics.metrics.activity_timeline,
      repository_stats: metrics.metrics.repository_stats || [],
      stars_trend: metrics.metrics.stars_trend,
      prs_trend: metrics.metrics.prs_trend,
      contributors_trend: metrics.metrics.contributors_trend,
      issues_trend: metrics.metrics.issues_trend,
      commits_trend: metrics.metrics.commits_trend,
    };
  }

  /**
   * Transform cached data back to WorkspaceMetrics format
   */
  private transformCacheToMetrics(cached: CachedMetrics): WorkspaceMetrics {
    return {
      id: cached.id || `${cached.workspace_id}-${cached.time_range}-${Date.now()}`,
      workspace_id: cached.workspace_id,
      period_start: cached.period_start,
      period_end: cached.period_end,
      time_range: cached.time_range,
      metrics: {
        total_prs: cached.total_prs,
        merged_prs: cached.merged_prs,
        open_prs: cached.open_prs,
        draft_prs: cached.draft_prs,
        total_issues: cached.total_issues,
        closed_issues: cached.closed_issues,
        open_issues: cached.open_issues,
        total_contributors: cached.total_contributors,
        active_contributors: cached.active_contributors,
        new_contributors: cached.new_contributors,
        total_commits: cached.total_commits,
        total_stars: cached.total_stars,
        total_forks: cached.total_forks,
        total_watchers: cached.total_watchers,
        avg_pr_merge_time_hours: cached.avg_pr_merge_time_hours,
        pr_velocity: cached.pr_velocity,
        issue_closure_rate: cached.issue_closure_rate,
        languages: cached.languages || {},
        top_contributors: cached.top_contributors || [],
        activity_timeline: cached.activity_timeline || [],
        repository_stats: cached.repository_stats,
        stars_trend: cached.stars_trend,
        prs_trend: cached.prs_trend,
        contributors_trend: cached.contributors_trend,
        issues_trend: cached.issues_trend,
        commits_trend: cached.commits_trend,
      },
      calculated_at: cached.calculated_at || cached.cached_at,
      expires_at: cached.expires_at || new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      is_stale: cached.is_stale || false,
    };
  }

  /**
   * Mark cache as stale
   */
  private async markCacheAsStale(workspaceId: string) {
    await this.supabase!.rpc('mark_workspace_cache_stale', {
      p_workspace_id: workspaceId,
    });
  }

  /**
   * Queue history update for trend tracking
   */
  private async queueHistoryUpdate(workspaceId: string, aggregatedData: AggregatedData) {
    const today = toDateOnlyString(new Date());

    const historyData = {
      workspace_id: workspaceId,
      metric_date: today,
      daily_prs: aggregatedData.totalPRs,
      daily_merged_prs: aggregatedData.mergedPRs,
      daily_issues: aggregatedData.totalIssues,
      daily_closed_issues: aggregatedData.closedIssues,
      daily_commits: aggregatedData.totalCommits,
      daily_active_contributors: aggregatedData.contributors.size,
      total_stars: aggregatedData.totalStars,
      total_forks: aggregatedData.totalForks,
      total_contributors: aggregatedData.contributors.size,
    };

    const { error } = await this.supabase!.from('workspace_metrics_history').upsert(historyData, {
      onConflict: 'workspace_id,metric_date',
    });

    if (error) {
      console.error('Failed to update metrics history:', error);
    }
  }

  /**
   * Create empty metrics for workspaces with no repositories
   */
  private createEmptyMetrics(
    workspaceId: string,
    timeRange: MetricsTimeRange,
    startTime: number
  ): AggregationResult {
    const { periodStart, periodEnd } = this.calculatePeriod(timeRange);

    const emptyMetrics: WorkspaceMetrics = {
      id: `${workspaceId}-${timeRange}-empty`,
      workspace_id: workspaceId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      time_range: timeRange,
      metrics: {
        total_prs: 0,
        merged_prs: 0,
        open_prs: 0,
        draft_prs: 0,
        total_issues: 0,
        closed_issues: 0,
        open_issues: 0,
        total_contributors: 0,
        active_contributors: 0,
        new_contributors: 0,
        total_commits: 0,
        total_stars: 0,
        total_forks: 0,
        total_watchers: 0,
        avg_pr_merge_time_hours: 0,
        pr_velocity: 0,
        issue_closure_rate: 0,
        languages: {},
        top_contributors: [],
        activity_timeline: [],
        repository_stats: [],
      },
      calculated_at: new Date().toISOString(),
      expires_at: this.calculateExpiryTime(timeRange).toISOString(),
      is_stale: false,
    };

    return {
      metrics: emptyMetrics,
      cacheHit: false,
      calculationTimeMs: performance.now() - startTime,
      githubApiCalls: 0,
    };
  }

  /**
   * Invalidate cache for a workspace
   */
  async invalidateCache(workspaceId: string) {
    await this.markCacheAsStale(workspaceId);
  }

  /**
   * Force refresh metrics for a workspace
   */
  async forceRefresh(workspaceId: string, timeRange: MetricsTimeRange) {
    return this.aggregateWorkspaceMetrics(workspaceId, {
      timeRange,
      forceRefresh: true,
      includeRepositoryStats: true,
    });
  }
}
