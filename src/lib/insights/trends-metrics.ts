import { fetchPRDataWithFallback } from '../supabase-pr-data';
import type { PullRequest } from '../types';
import { getTrendDirection, getTrendDirectionReverse } from '@/lib/utils/performance-helpers';

export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: string; // We'll use string names for icons
  unit?: string;
  insight?: string;
  // Status information for proper error handling
  status?:
    | 'success'
    | 'large_repository_protected'
    | 'no_data'
    | 'error'
    | 'partial_data'
    | 'pending';
  message?: string;
  repositoryName?: string;
}

/**
 * Calculate real trend metrics comparing current vs previous period
 */
export async function calculateTrendMetrics(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<TrendData[]> {
  try {
    // Parse timeRange to determine periods
    const days = parseInt(timeRange) || 30;
    const now = new Date();

    // Define current and previous periods based on timeRange
    let currentPeriodDays: number;
    let periodLabel: string;

    if (days <= 7) {
      currentPeriodDays = days;
      periodLabel = 'day';
    } else if (days <= 30) {
      currentPeriodDays = 7; // Weekly comparison
      periodLabel = 'week';
    } else {
      currentPeriodDays = 30; // Monthly comparison
      periodLabel = 'month';
    }

    const currentPeriodStart = new Date(now.getTime() - currentPeriodDays * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(
      now.getTime() - 2 * currentPeriodDays * 24 * 60 * 60 * 1000
    );

    // Fetch data (try database first, fallback to GitHub API)
    const prDataResult = await fetchPRDataWithFallback(owner, repo, timeRange);
    const allPRs = prDataResult.data;

    // Handle case where no data is available or special status
    if (!allPRs || allPRs.length === 0) {
      return getEmptyTrends(prDataResult.status, prDataResult.message, prDataResult.repositoryName);
    }

    // Calculate PR Volume
    const currentPRs = allPRs.filter((pr) => {
      const createdAt = new Date(pr.created_at);
      return createdAt >= currentPeriodStart;
    });

    const previousPRs = allPRs.filter((pr) => {
      const createdAt = new Date(pr.created_at);
      return createdAt >= previousPeriodStart && createdAt < currentPeriodStart;
    });

    // Calculate Active Contributors
    const currentContributors = new Set<string>();
    const previousContributors = new Set<string>();

    currentPRs.forEach((pr) => {
      if (pr.user?.login) currentContributors.add(pr.user.login);
    });

    previousPRs.forEach((pr) => {
      if (pr.user?.login) previousContributors.add(pr.user.login);
    });

    const contributorChange =
      previousContributors.size > 0
        ? Math.round(
            ((currentContributors.size - previousContributors.size) / previousContributors.size) *
              100
          )
        : 0;

    // Calculate Average Review Time
    const calculateAvgReviewTime = (prs: PullRequest[]) => {
      const reviewTimes: number[] = [];

      prs.forEach((pr) => {
        if (pr.merged_at) {
          const created = new Date(pr.created_at);
          const merged = new Date(pr.merged_at);
          const hours = (merged.getTime() - created.getTime()) / (1000 * 60 * 60);
          reviewTimes.push(hours);
        }
      });

      return reviewTimes.length > 0
        ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length
        : 0;
    };

    const currentAvgReview = calculateAvgReviewTime(currentPRs);
    const previousAvgReview = calculateAvgReviewTime(previousPRs);

    const reviewTimeChange =
      previousAvgReview > 0
        ? Math.round(((currentAvgReview - previousAvgReview) / previousAvgReview) * 100)
        : 0;

    // Calculate PR Completion Rate
    const calculateCompletionRate = (prs: PullRequest[]) => {
      const merged = prs.filter((pr) => pr.merged_at).length;
      return prs.length > 0 ? (merged / prs.length) * 100 : 0;
    };

    const currentCompletionRate = calculateCompletionRate(currentPRs);
    const previousCompletionRate = calculateCompletionRate(previousPRs);

    const completionChange =
      previousCompletionRate > 0
        ? Math.round(
            ((currentCompletionRate - previousCompletionRate) / previousCompletionRate) * 100
          )
        : 0;

    // Calculate Review Activity
    const calculateReviewActivity = (prs: PullRequest[]) => {
      return prs.reduce((total, pr) => total + (pr.reviews?.length || 0), 0);
    };

    const currentReviews = calculateReviewActivity(currentPRs);
    const previousReviews = calculateReviewActivity(previousPRs);

    const reviewChange =
      previousReviews > 0
        ? Math.round(((currentReviews - previousReviews) / previousReviews) * 100)
        : 0;

    // Calculate Comment Activity
    const calculateCommentActivity = (prs: PullRequest[]) => {
      return prs.reduce((total, pr) => total + (pr.comments?.length || 0), 0);
    };

    const currentComments = calculateCommentActivity(currentPRs);
    const previousComments = calculateCommentActivity(previousPRs);

    const commentChange =
      previousComments > 0
        ? Math.round(((currentComments - previousComments) / previousComments) * 100)
        : 0;

    // Calculate daily PR volume (average PRs per day for the period)
    const dailyPRVolumeCurrent = currentPRs.length / currentPeriodDays;
    const dailyPRVolumePrevious = previousPRs.length / currentPeriodDays;
    const dailyVolumeChange =
      dailyPRVolumePrevious > 0
        ? Math.round(((dailyPRVolumeCurrent - dailyPRVolumePrevious) / dailyPRVolumePrevious) * 100)
        : 0;

    // Build trends array
    const trends: TrendData[] = [
      {
        metric: `Daily PR Volume`,
        current: Math.round(dailyPRVolumeCurrent), // Round to whole number
        previous: Math.round(dailyPRVolumePrevious), // Round to whole number
        change: dailyVolumeChange,
        trend: getTrendDirection(dailyVolumeChange),
        icon: 'GitPullRequest',
        unit: 'PRs/day',
        insight: (() => {
          if (dailyVolumeChange > 0)
            return `${Math.abs(dailyVolumeChange)}% increase in daily PR submissions`;
          if (dailyVolumeChange < 0)
            return `${Math.abs(dailyVolumeChange)}% decrease in daily PR submissions`;
          return 'Daily PR volume remains stable';
        })(),
      },
      {
        metric: 'Active Contributors',
        current: currentContributors.size,
        previous: previousContributors.size,
        change: contributorChange,
        trend: getTrendDirection(contributorChange),
        icon: 'Users',
        unit: 'people',
        insight: (() => {
          const diff = currentContributors.size - previousContributors.size;
          if (diff > 0) return `${diff} new contributors joined`;
          if (contributorChange < 0) return `${Math.abs(diff)} contributors less active`;
          return 'Contributor count stable';
        })(),
      },
      {
        metric: 'Avg Review Time',
        current: Math.round(currentAvgReview),
        previous: Math.round(previousAvgReview),
        change: reviewTimeChange,
        trend: getTrendDirectionReverse(reviewTimeChange),
        icon: 'Calendar',
        unit: 'hours',
        insight: (() => {
          if (reviewTimeChange < 0)
            return `Review time improved by ${Math.abs(Math.round(currentAvgReview - previousAvgReview))} hours`;
          if (reviewTimeChange > 0)
            return `Review time increased by ${Math.round(currentAvgReview - previousAvgReview)} hours`;
          return 'Review time remains consistent';
        })(),
      },
      {
        metric: 'PR Completion Rate',
        current: Math.round(currentCompletionRate),
        previous: Math.round(previousCompletionRate),
        change: completionChange,
        trend: getTrendDirection(completionChange),
        icon: 'Activity',
        unit: '%',
        insight: (() => {
          if (completionChange > 0) return 'More PRs are being merged successfully';
          if (completionChange < 0) return 'PR completion rate has decreased';
          return 'PR completion rate stable';
        })(),
      },
      {
        metric: 'Review Activity',
        current: currentReviews,
        previous: previousReviews,
        change: reviewChange,
        trend: getTrendDirection(reviewChange),
        icon: 'GitPullRequestDraft',
        unit: 'reviews',
        insight: (() => {
          if (reviewChange > 0)
            return `${Math.abs(currentReviews - previousReviews)} more reviews this ${periodLabel}`;
          if (reviewChange < 0)
            return `${Math.abs(currentReviews - previousReviews)} fewer reviews this ${periodLabel}`;
          return 'Review activity stable';
        })(),
      },
      {
        metric: 'Comment Activity',
        current: currentComments,
        previous: previousComments,
        change: commentChange,
        trend: getTrendDirection(commentChange),
        icon: 'MessageSquare',
        unit: 'comments',
        insight: (() => {
          if (commentChange > 0)
            return `${Math.abs(currentComments - previousComments)} more comments this ${periodLabel}`;
          if (commentChange < 0)
            return `${Math.abs(currentComments - previousComments)} fewer comments this ${periodLabel}`;
          return 'Comment activity stable';
        })(),
      },
    ];

    return trends;
  } catch (error) {
    console.error('Error calculating trend metrics:', error);
    // Return empty trends on error to prevent component crashes
    return getEmptyTrends(
      'error',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      `${owner}/${repo}`
    );
  }
}

/**
 * Returns empty trend data when no data is available
 * This prevents component crashes and provides graceful degradation
 */
function getEmptyTrends(
  status:
    | 'success'
    | 'large_repository_protected'
    | 'no_data'
    | 'error'
    | 'partial_data'
    | 'pending' = 'no_data',
  message?: string,
  repositoryName?: string
): TrendData[] {
  return [
    {
      metric: `Daily PR Volume`,
      current: 0,
      previous: 0,
      change: 0,
      trend: 'stable',
      icon: 'GitPullRequest',
      unit: 'PRs/day',
      insight: message || 'No recent PR data available',
      status,
      message,
      repositoryName,
    },
    {
      metric: 'Active Contributors',
      current: 0,
      previous: 0,
      change: 0,
      trend: 'stable',
      icon: 'Users',
      unit: 'contributors',
      insight: message || 'No contributor data available',
      status,
      message,
      repositoryName,
    },
    {
      metric: 'Avg Review Time',
      current: 0,
      previous: 0,
      change: 0,
      trend: 'stable',
      icon: 'Clock',
      unit: 'hours',
      insight: message || 'No review data available',
      status,
      message,
      repositoryName,
    },
    {
      metric: 'PR Completion Rate',
      current: 0,
      previous: 0,
      change: 0,
      trend: 'stable',
      icon: 'CheckCircle',
      unit: '%',
      insight: message || 'No completion data available',
      status,
      message,
      repositoryName,
    },
    {
      metric: 'Review Activity',
      current: 0,
      previous: 0,
      change: 0,
      trend: 'stable',
      icon: 'GitPullRequestDraft',
      unit: 'reviews',
      insight: message || 'No review data available',
      status,
      message,
      repositoryName,
    },
    {
      metric: 'Comment Activity',
      current: 0,
      previous: 0,
      change: 0,
      trend: 'stable',
      icon: 'MessageSquare',
      unit: 'comments',
      insight: message || 'No comment data available',
      status,
      message,
      repositoryName,
    },
  ];
}
