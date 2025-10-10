/**
 * Service for calculating workspace metrics and trends
 */

import type {
  WorkspaceMetrics,
  WorkspaceTrendData,
  Repository,
  ActivityDataPoint,
} from '@/components/features/workspace';
import { TIME_RANGE_DAYS, type TimeRange } from '@/lib/utils/time-range';

export interface MergedPR {
  merged_at: string;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
}

export interface PRData {
  created_at: string;
  state: string;
  commits?: number;
}

export interface IssueData {
  created_at: string;
  state: string;
}

export interface PreviousMetrics {
  prCount: number;
  contributorCount: number;
  starCount: number;
  commitCount: number;
  issueCount?: number;
}

/**
 * Calculate workspace metrics from repository data
 */
export function calculateWorkspaceMetrics(
  repos: Repository[],
  prCount: number = 0,
  contributorCount: number = 0,
  commitCount: number = 0,
  issueCount: number = 0,
  previousMetrics?: PreviousMetrics
): WorkspaceMetrics {
  const totalStars = repos.reduce((sum, repo) => sum + (repo.stars || 0), 0);
  const totalOpenPRs = repos.reduce((sum, repo) => sum + (repo.open_prs || 0), 0);
  const totalOpenIssues = repos.reduce((sum, repo) => sum + (repo.open_issues || 0), 0);

  // Calculate trends if we have previous metrics
  let starsTrend = 0;
  let prsTrend = 0;
  let contributorsTrend = 0;
  let commitsTrend = 0;
  let issuesTrend = 0;

  if (previousMetrics) {
    starsTrend =
      previousMetrics.starCount > 0
        ? ((totalStars - previousMetrics.starCount) / previousMetrics.starCount) * 100
        : 0;
    prsTrend =
      previousMetrics.prCount > 0
        ? ((totalOpenPRs - previousMetrics.prCount) / previousMetrics.prCount) * 100
        : 0;
    contributorsTrend =
      previousMetrics.contributorCount > 0
        ? ((contributorCount - previousMetrics.contributorCount) /
            previousMetrics.contributorCount) *
          100
        : 0;
    commitsTrend =
      previousMetrics.commitCount > 0
        ? ((commitCount - previousMetrics.commitCount) / previousMetrics.commitCount) * 100
        : 0;
    
    if (previousMetrics.issueCount !== undefined) {
      issuesTrend =
        previousMetrics.issueCount > 0
          ? ((totalOpenIssues - previousMetrics.issueCount) / previousMetrics.issueCount) * 100
          : 0;
    }
  }

  return {
    totalStars,
    totalPRs: totalOpenPRs || prCount,
    totalIssues: totalOpenIssues || issueCount || 0,
    totalContributors: contributorCount,
    totalCommits: commitCount,
    starsTrend,
    prsTrend,
    issuesTrend,
    contributorsTrend,
    commitsTrend,
  };
}

/**
 * Calculate trend data from historical PR and issue data
 */
export function calculateTrendData(
  days: number,
  prData: PRData[] = [],
  issueData: IssueData[] = []
): WorkspaceTrendData {
  const labels = [];
  const prCounts = [];
  const issueCounts = [];
  const commitCounts = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    const dayPRs = prData.filter((pr) => pr.created_at.split('T')[0] === dateStr);
    prCounts.push(dayPRs.length);

    const dayCommits = dayPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0);
    commitCounts.push(dayCommits);

    const dayIssues = issueData.filter(
      (issue) => issue.created_at.split('T')[0] === dateStr
    ).length;
    issueCounts.push(dayIssues);
  }

  return {
    labels,
    datasets: [
      {
        label: 'Pull Requests',
        data: prCounts,
        color: '#10b981',
      },
      {
        label: 'Issues',
        data: issueCounts,
        color: '#f97316',
      },
      {
        label: 'Commits',
        data: commitCounts,
        color: '#8b5cf6',
      },
    ],
  };
}

/**
 * Generate activity data from merged PRs
 */
export function generateActivityData(
  mergedPRs: MergedPR[],
  timeRange: TimeRange
): ActivityDataPoint[] {
  if (!mergedPRs || mergedPRs.length === 0) {
    return [];
  }

  const prsByDate = new Map<string, MergedPR[]>();

  mergedPRs.forEach((pr) => {
    const date = new Date(pr.merged_at).toISOString().split('T')[0];
    if (!prsByDate.has(date)) {
      prsByDate.set(date, []);
    }
    prsByDate.get(date)!.push(pr);
  });

  const activityData: ActivityDataPoint[] = [];

  prsByDate.forEach((prs, date) => {
    const totalAdditions = prs.reduce((sum, pr) => sum + (pr.additions || 0), 0);
    const totalDeletions = prs.reduce((sum, pr) => sum + (pr.deletions || 0), 0);
    const totalCommits = prs.reduce((sum, pr) => sum + (pr.commits || 0), 0);
    const totalFilesChanged = prs.reduce((sum, pr) => sum + (pr.changed_files || 0), 0);

    if (totalAdditions > 0 || totalDeletions > 0 || totalCommits > 0) {
      activityData.push({
        date,
        additions: totalAdditions,
        deletions: totalDeletions,
        commits: totalCommits,
        files_changed: totalFilesChanged,
      });
    }
  });

  activityData.sort((a, b) => a.date.localeCompare(b.date));

  // Fill in gaps for continuous chart display (optional, only for recent dates)
  if (activityData.length > 0 && timeRange !== 'all') {
    const filledData: ActivityDataPoint[] = [];
    const startDate = new Date(activityData[0].date);
    const endDate = new Date(activityData[activityData.length - 1].date);
    const dataMap = new Map(activityData.map((d) => [d.date, d]));

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      filledData.push(
        dataMap.get(dateStr) || {
          date: dateStr,
          additions: 0,
          deletions: 0,
          commits: 0,
          files_changed: 0,
        }
      );
    }

    return filledData;
  }

  return activityData;
}

/**
 * Calculate previous period metrics for trend comparison
 */
export function calculatePreviousMetrics(
  timeRange: TimeRange,
  prData: PRData[],
  issueData: IssueData[],
  repos: Repository[],
  uniqueContributorCount: number
): PreviousMetrics {
  const daysInRange = TIME_RANGE_DAYS[timeRange];
  const today = new Date();
  const periodStart = new Date(today);
  periodStart.setDate(today.getDate() - daysInRange);
  const previousPeriodStart = new Date(periodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - daysInRange);

  const previousPRs = prData.filter((pr) => {
    const prDate = new Date(pr.created_at);
    return prDate >= previousPeriodStart && prDate < periodStart;
  });

  const previousIssues = issueData.filter((issue) => {
    const issueDate = new Date(issue.created_at);
    return issueDate >= previousPeriodStart && issueDate < periodStart;
  });

  return {
    starCount: repos.reduce((sum, repo) => sum + (repo.stars || 0), 0),
    prCount: previousPRs.length,
    issueCount: previousIssues.length,
    contributorCount: uniqueContributorCount,
    commitCount: previousPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0),
  };
}
