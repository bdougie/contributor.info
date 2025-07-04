import { fetchPRDataWithFallback } from '../supabase-pr-data';
import type { PullRequest } from '../types';

export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: "up" | "down" | "stable";
  icon: string; // We'll use string names for icons
  unit?: string;
  insight?: string;
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
      periodLabel = "day";
    } else if (days <= 30) {
      currentPeriodDays = 7; // Weekly comparison
      periodLabel = "week";
    } else {
      currentPeriodDays = 30; // Monthly comparison
      periodLabel = "month";
    }
    
    const currentPeriodStart = new Date(now.getTime() - currentPeriodDays * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(now.getTime() - 2 * currentPeriodDays * 24 * 60 * 60 * 1000);
    
    // Fetch data (try database first, fallback to GitHub API)
    const allPRs = await fetchPRDataWithFallback(owner, repo, timeRange);
    
    // Debug logging
    if (import.meta.env.DEV) {
      console.log(`Trends Debug - ${owner}/${repo}: Fetched ${allPRs.length} PRs for timeRange ${timeRange}`);
      console.log(`Trends Debug - Period: ${currentPeriodDays} ${periodLabel}s`);
      console.log(`Trends Debug - Current period start: ${currentPeriodStart.toISOString()}`);
      console.log(`Trends Debug - Previous period start: ${previousPeriodStart.toISOString()}`);
    }
    
    // Calculate PR Volume
    const currentPRs = allPRs.filter(pr => {
      const createdAt = new Date(pr.created_at);
      return createdAt >= currentPeriodStart;
    });
    
    const previousPRs = allPRs.filter(pr => {
      const createdAt = new Date(pr.created_at);
      return createdAt >= previousPeriodStart && createdAt < currentPeriodStart;
    });
    
    // Debug logging for filtered results
    if (import.meta.env.DEV) {
      console.log(`Trends Debug - Current PRs: ${currentPRs.length}, Previous PRs: ${previousPRs.length}`);
      if (currentPRs.length > 0) {
        console.log(`Trends Debug - Sample current PR dates:`, currentPRs.slice(0, 3).map(pr => pr.created_at));
      }
      if (previousPRs.length > 0) {
        console.log(`Trends Debug - Sample previous PR dates:`, previousPRs.slice(0, 3).map(pr => pr.created_at));
      }
    }
    
    const prVolumeChange = previousPRs.length > 0
      ? Math.round(((currentPRs.length - previousPRs.length) / previousPRs.length) * 100)
      : 0;
    
    // Calculate Active Contributors
    const currentContributors = new Set<string>();
    const previousContributors = new Set<string>();
    
    currentPRs.forEach(pr => {
      if (pr.user?.login) currentContributors.add(pr.user.login);
    });
    
    previousPRs.forEach(pr => {
      if (pr.user?.login) previousContributors.add(pr.user.login);
    });
    
    const contributorChange = previousContributors.size > 0
      ? Math.round(((currentContributors.size - previousContributors.size) / previousContributors.size) * 100)
      : 0;
    
    // Calculate Average Review Time
    const calculateAvgReviewTime = (prs: PullRequest[]) => {
      const reviewTimes: number[] = [];
      
      prs.forEach(pr => {
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
    
    const reviewTimeChange = previousAvgReview > 0
      ? Math.round(((currentAvgReview - previousAvgReview) / previousAvgReview) * 100)
      : 0;
    
    // Calculate PR Completion Rate
    const calculateCompletionRate = (prs: PullRequest[]) => {
      const merged = prs.filter(pr => pr.merged_at).length;
      return prs.length > 0 ? (merged / prs.length) * 100 : 0;
    };
    
    const currentCompletionRate = calculateCompletionRate(currentPRs);
    const previousCompletionRate = calculateCompletionRate(previousPRs);
    
    const completionChange = previousCompletionRate > 0
      ? Math.round(((currentCompletionRate - previousCompletionRate) / previousCompletionRate) * 100)
      : 0;
    
    // Build trends array
    const trends: TrendData[] = [
      {
        metric: `${periodLabel === "week" ? "Weekly" : periodLabel === "month" ? "Monthly" : "Daily"} PR Volume`,
        current: currentPRs.length,
        previous: previousPRs.length,
        change: prVolumeChange,
        trend: prVolumeChange > 0 ? "up" : prVolumeChange < 0 ? "down" : "stable",
        icon: "GitPullRequest",
        unit: "PRs",
        insight: prVolumeChange > 0 
          ? `${Math.abs(prVolumeChange)}% increase in PR submissions`
          : prVolumeChange < 0
          ? `${Math.abs(prVolumeChange)}% decrease in PR submissions`
          : "PR volume remains stable"
      },
      {
        metric: "Active Contributors",
        current: currentContributors.size,
        previous: previousContributors.size,
        change: contributorChange,
        trend: contributorChange > 0 ? "up" : contributorChange < 0 ? "down" : "stable",
        icon: "Users",
        unit: "people",
        insight: currentContributors.size - previousContributors.size > 0
          ? `${currentContributors.size - previousContributors.size} new contributors joined`
          : contributorChange < 0
          ? `${Math.abs(currentContributors.size - previousContributors.size)} contributors less active`
          : "Contributor count stable"
      },
      {
        metric: "Avg Review Time",
        current: Math.round(currentAvgReview),
        previous: Math.round(previousAvgReview),
        change: reviewTimeChange,
        trend: reviewTimeChange < 0 ? "down" : reviewTimeChange > 0 ? "up" : "stable",
        icon: "Calendar",
        unit: "hours",
        insight: reviewTimeChange < 0
          ? `Review time improved by ${Math.abs(Math.round(currentAvgReview - previousAvgReview))} hours`
          : reviewTimeChange > 0
          ? `Review time increased by ${Math.round(currentAvgReview - previousAvgReview)} hours`
          : "Review time remains consistent"
      },
      {
        metric: "PR Completion Rate",
        current: Math.round(currentCompletionRate),
        previous: Math.round(previousCompletionRate),
        change: completionChange,
        trend: completionChange > 0 ? "up" : completionChange < 0 ? "down" : "stable",
        icon: "Activity",
        unit: "%",
        insight: completionChange > 0
          ? "More PRs are being merged successfully"
          : completionChange < 0
          ? "PR completion rate has decreased"
          : "PR completion rate stable"
      }
    ];
    
    return trends;
    
  } catch (error) {
    console.error('Error calculating trend metrics:', error);
    return [];
  }
}