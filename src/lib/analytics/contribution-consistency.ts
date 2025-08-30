import { PullRequest } from '@/lib/types';
import { ContributionConsistencyMetrics } from '@/lib/types/advanced-analytics';

/**
 * Analyzes contribution patterns to determine consistency score
 * Higher scores indicate more reliable, consistent contributors
 */
export class ContributionConsistencyAnalyzer {
  /**
   * Calculate comprehensive consistency metrics for a contributor
   */
  static analyzeContributor(
    login: string,
    pullRequests: PullRequest[],
    timeRangeWeeks: number = 52 // Default: 1 year analysis
  ): ContributionConsistencyMetrics {
    const userPRs = pullRequests.filter(pr => 
      pr.user?.login?.toLowerCase() === login.toLowerCase() ||
      pr.author?.login?.toLowerCase() === login.toLowerCase()
    );

    if (userPRs.length === 0) {
      return this.getEmptyMetrics(login);
    }

    // Sort PRs by creation date
    const sortedPRs = userPRs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const activityPattern = this.calculateActivityPattern(sortedPRs, timeRangeWeeks);
    const reliabilityMetrics = this.calculateReliabilityMetrics(sortedPRs);
    const consistencyScore = this.calculateConsistencyScore(activityPattern, reliabilityMetrics);

    return {
      login,
      consistencyScore,
      activityPattern,
      reliabilityMetrics,
    };
  }

  /**
   * Calculate weekly activity patterns and trends
   */
  private static calculateActivityPattern(
    sortedPRs: PullRequest[], 
    timeRangeWeeks: number
  ) {
    const now = new Date();
    const startDate = new Date(now.getTime() - (timeRangeWeeks * 7 * 24 * 60 * 60 * 1000));
    
    // Initialize weekly commit array
    const weeklyCommits = new Array(timeRangeWeeks).fill(0);
    
    // Count PRs per week
    sortedPRs.forEach(pr => {
      const prDate = new Date(pr.created_at);
      if (prDate >= startDate) {
        const weeksFromStart = Math.floor(
          (prDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        if (weeksFromStart >= 0 && weeksFromStart < timeRangeWeeks) {
          weeklyCommits[weeksFromStart]++;
        }
      }
    });

    // Calculate trend using simple linear regression
    const monthlyTrend = this.calculateTrend(weeklyCommits);
    
    // Calculate streaks
    const { longestActiveStreak, longestInactiveStreak } = this.calculateStreaks(weeklyCommits);
    
    // Basic statistics
    const averageCommitsPerWeek = weeklyCommits.reduce((a, b) => a + b, 0) / timeRangeWeeks;
    const variance = weeklyCommits.reduce((sum, week) => 
      sum + Math.pow(week - averageCommitsPerWeek, 2), 0
    ) / timeRangeWeeks;
    const standardDeviation = Math.sqrt(variance);

    return {
      weeklyCommits,
      monthlyTrend,
      longestActiveStreak,
      longestInactiveStreak,
      averageCommitsPerWeek: Math.round(averageCommitsPerWeek * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
    };
  }

  /**
   * Calculate reliability metrics based on PR interactions
   */
  private static calculateReliabilityMetrics(sortedPRs: PullRequest[]) {
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let qualityScores: number[] = [];

    // Analyze each PR for reliability indicators
    sortedPRs.forEach(pr => {
      // Response time calculation (if we have review data)
      if (pr.reviews && pr.reviews.length > 0) {
        const prCreated = new Date(pr.created_at).getTime();
        const firstReview = pr.reviews.sort((a, b) => 
          new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
        )[0];
        
        const responseTime = (new Date(firstReview.submitted_at).getTime() - prCreated) / (1000 * 60 * 60);
        if (responseTime > 0 && responseTime < 24 * 7) { // Filter out unrealistic times
          totalResponseTime += responseTime;
          responseTimeCount++;
        }
      }

      // Code quality indicators
      const qualityScore = this.calculateCodeQualityScore(pr);
      qualityScores.push(qualityScore);
    });

    const averageResponseTime = responseTimeCount > 0 
      ? Math.round(totalResponseTime / responseTimeCount * 100) / 100 
      : 0;

    // Commitment keeping rate (simplified as merge rate for now)
    const mergeRate = sortedPRs.filter(pr => pr.merged_at).length / sortedPRs.length;

    // Code quality consistency (inverse of standard deviation)
    const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
    const qualityVariance = qualityScores.reduce((sum, score) => 
      sum + Math.pow(score - avgQuality, 2), 0
    ) / qualityScores.length;
    const codeQualityConsistency = Math.max(0, 100 - Math.sqrt(qualityVariance) * 10);

    return {
      averageResponseTime,
      commitmentKeepingRate: Math.round(mergeRate * 100),
      codeQualityConsistency: Math.round(codeQualityConsistency),
    };
  }

  /**
   * Calculate overall consistency score (0-100)
   */
  private static calculateConsistencyScore(
    activityPattern: any,
    reliabilityMetrics: any
  ): number {
    // Activity consistency score (40% weight)
    const activityScore = Math.max(0, 100 - (activityPattern.standardDeviation * 10));
    
    // Reliability score (40% weight)
    const reliabilityScore = (
      reliabilityMetrics.commitmentKeepingRate * 0.5 +
      reliabilityMetrics.codeQualityConsistency * 0.3 +
      (reliabilityMetrics.averageResponseTime > 0 
        ? Math.max(0, 100 - reliabilityMetrics.averageResponseTime) 
        : 70) * 0.2
    );

    // Longevity bonus (20% weight)
    const longevityScore = Math.min(100, activityPattern.longestActiveStreak * 2);

    const finalScore = (
      activityScore * 0.4 +
      reliabilityScore * 0.4 +
      longevityScore * 0.2
    );

    return Math.round(Math.max(0, Math.min(100, finalScore)));
  }

  /**
   * Calculate trend direction using simple linear regression
   */
  private static calculateTrend(weeklyData: number[]) {
    const n = weeklyData.length;
    const xSum = n * (n - 1) / 2; // Sum of indices
    const ySum = weeklyData.reduce((a, b) => a + b, 0);
    const xySum = weeklyData.reduce((sum, y, x) => sum + x * y, 0);
    const xxSum = n * (n - 1) * (2 * n - 1) / 6; // Sum of squares of indices

    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);

    if (Math.abs(slope) < 0.01) return 'stable';
    if (slope > 0.1) return 'increasing';
    if (slope < -0.1) return 'decreasing';
    return 'volatile';
  }

  /**
   * Calculate activity streaks
   */
  private static calculateStreaks(weeklyCommits: number[]) {
    let longestActiveStreak = 0;
    let longestInactiveStreak = 0;
    let currentActiveStreak = 0;
    let currentInactiveStreak = 0;

    weeklyCommits.forEach(weekCommits => {
      if (weekCommits > 0) {
        currentActiveStreak++;
        currentInactiveStreak = 0;
        longestActiveStreak = Math.max(longestActiveStreak, currentActiveStreak);
      } else {
        currentInactiveStreak++;
        currentActiveStreak = 0;
        longestInactiveStreak = Math.max(longestInactiveStreak, currentInactiveStreak);
      }
    });

    return { longestActiveStreak, longestInactiveStreak };
  }

  /**
   * Calculate code quality score based on PR metrics
   */
  private static calculateCodeQualityScore(pr: PullRequest): number {
    let score = 50; // Base score

    // Size indicators (moderate PRs score higher)
    const changedLines = (pr.additions || 0) + (pr.deletions || 0);
    if (changedLines > 0 && changedLines < 200) score += 20;
    else if (changedLines > 1000) score -= 10;

    // Review engagement (PRs with reviews score higher)
    if (pr.reviews && pr.reviews.length > 0) {
      score += 15;
      // Approved reviews are better
      const approvedReviews = pr.reviews.filter(r => r.state === 'APPROVED').length;
      score += Math.min(15, approvedReviews * 5);
    }

    // Merge status
    if (pr.merged_at) score += 20;
    else if (pr.state === 'closed') score -= 20;

    // Discussion (comments indicate engagement)
    if (pr.comments && pr.comments.length > 0) {
      score += Math.min(10, pr.comments.length * 2);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Return empty metrics structure
   */
  private static getEmptyMetrics(login: string): ContributionConsistencyMetrics {
    return {
      login,
      consistencyScore: 0,
      activityPattern: {
        weeklyCommits: [],
        monthlyTrend: 'stable',
        longestActiveStreak: 0,
        longestInactiveStreak: 0,
        averageCommitsPerWeek: 0,
        standardDeviation: 0,
      },
      reliabilityMetrics: {
        averageResponseTime: 0,
        commitmentKeepingRate: 0,
        codeQualityConsistency: 0,
      },
    };
  }
}

/**
 * Batch analyze multiple contributors
 */
export function analyzeContributorConsistency(
  contributors: string[],
  pullRequests: PullRequest[],
  timeRangeWeeks: number = 52
): ContributionConsistencyMetrics[] {
  return contributors.map(login =>
    ContributionConsistencyAnalyzer.analyzeContributor(login, pullRequests, timeRangeWeeks)
  );
}

/**
 * Get consistency rankings (highest to lowest)
 */
export function getConsistencyRankings(
  contributors: string[],
  pullRequests: PullRequest[],
  limit: number = 50
): ContributionConsistencyMetrics[] {
  const metrics = analyzeContributorConsistency(contributors, pullRequests);
  
  return metrics
    .sort((a, b) => b.consistencyScore - a.consistencyScore)
    .slice(0, limit);
}