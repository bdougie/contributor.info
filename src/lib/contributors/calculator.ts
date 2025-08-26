/**
 * Core calculation logic for weighted activity scoring and contributor ranking
 */

import {
  ContributorActivity,
  ContributorRanking,
  ACTIVITY_WEIGHTS,
  Leaderboard,
  MonthlyWinner,
  MonthlyCycleState,
  CyclePhase,
  ContributorCalculationConfig,
} from './types';
import { getCurrentMonthlyCycleState, getMonthDateRange } from '../utils/date-helpers';

/**
 * Default configuration for contributor calculations
 */
export const DEFAULT_CALCULATION_CONFIG: ContributorCalculationConfig = {
  minimumActivityThreshold: 1, // At least 1 activity to be included
  maxLeaderboardSize: 20, // Top 20 contributors
  includeInactiveContributors: false,
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
    keyPrefix: 'contributor_calc',
    maxSize: 100,
  },
};

/**
 * Calculates the weighted score for a contributor based on their activity
 */
export function calculateWeightedScore(activity: ContributorActivity): number {
  // Only count merged PRs for scoring, not all PRs
  const mergedPullRequestsScore = activity.mergedPullRequests * ACTIVITY_WEIGHTS.PULL_REQUESTS;
  const commentsScore = activity.comments * ACTIVITY_WEIGHTS.COMMENTS;
  const reviewsScore = activity.reviews * ACTIVITY_WEIGHTS.REVIEWS;
  
  return mergedPullRequestsScore + commentsScore + reviewsScore;
}

/**
 * Creates a detailed score breakdown for display purposes
 */
export function createScoreBreakdown(activity: ContributorActivity) {
  return {
    pullRequestsScore: activity.pullRequests * ACTIVITY_WEIGHTS.PULL_REQUESTS,
    mergedPullRequestsScore: activity.mergedPullRequests * ACTIVITY_WEIGHTS.PULL_REQUESTS,
    commentsScore: activity.comments * ACTIVITY_WEIGHTS.COMMENTS,
    reviewsScore: activity.reviews * ACTIVITY_WEIGHTS.REVIEWS,
  };
}

/**
 * Calculates the total activity count for a contributor (includes all PRs for activity threshold)
 */
export function calculateTotalActivity(activity: ContributorActivity): number {
  return activity.pullRequests + activity.comments + activity.reviews;
}

/**
 * Determines if a contributor meets the minimum activity threshold
 */
export function meetsActivityThreshold(
  activity: ContributorActivity,
  threshold: number
): boolean {
  const totalActivity = calculateTotalActivity(activity);
  return totalActivity >= threshold;
}

/**
 * Sorts contributors by weighted score with tie-breaking logic
 * Tie-breaker: contributor with earliest contribution wins
 */
export function sortContributorsByScore(
  contributors: ContributorActivity[]
): ContributorActivity[] {
  return [...contributors].sort((a, b) => {
    const scoreA = calculateWeightedScore(a);
    const scoreB = calculateWeightedScore(b);
    
    // Primary sort: higher score wins
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    
    // Tie-breaker: earlier contribution wins
    return a.earliestContribution.getTime() - b.earliestContribution.getTime();
  });
}

/**
 * Creates contributor rankings with scores and positions
 */
export function createContributorRankings(
  contributors: ContributorActivity[],
  config: Partial<ContributorCalculationConfig> = {}
): ContributorRanking[] {
  const fullConfig = { ...DEFAULT_CALCULATION_CONFIG, ...config };
  
  // Filter by activity threshold
  const eligibleContributors = contributors.filter(contributor =>
    meetsActivityThreshold(contributor, fullConfig.minimumActivityThreshold)
  );
  
  // Sort by score
  const sortedContributors = sortContributorsByScore(eligibleContributors);
  
  // Limit to max leaderboard size
  const limitedContributors = sortedContributors.slice(0, fullConfig.maxLeaderboardSize);
  
  // Create rankings with tie detection
  const rankings: ContributorRanking[] = [];
  let currentRank = 1;
  
  for (let i = 0; i < limitedContributors.length; i++) {
    const contributor = limitedContributors[i];
    const weightedScore = calculateWeightedScore(contributor);
    const scoreBreakdown = createScoreBreakdown(contributor);
    
    // Check for ties with previous contributor
    let isTied = false;
    if (i > 0) {
      const previousScore = calculateWeightedScore(limitedContributors[i - 1]);
      if (weightedScore === previousScore) {
        isTied = true;
      } else {
        // Update rank if no tie
        currentRank = i + 1;
      }
    }
    
    // Check for ties with next contributor
    if (i < limitedContributors.length - 1) {
      const nextScore = calculateWeightedScore(limitedContributors[i + 1]);
      if (weightedScore === nextScore) {
        isTied = true;
      }
    }
    
    rankings.push({
      contributor,
      weightedScore,
      rank: currentRank,
      scoreBreakdown,
      isTied,
    });
  }
  
  return rankings;
}

/**
 * Determines the winner from a list of contributors for a specific month
 * Uses tie-breaking logic if multiple contributors have the same top score
 */
export function determineMonthlyWinner(
  contributors: ContributorActivity[],
  month: number,
  year: number,
  config: Partial<ContributorCalculationConfig> = {}
): MonthlyWinner | null {
  const rankings = createContributorRankings(contributors, config);
  
  if (rankings.length === 0) {
    return null;
  }
  
  const topRanking = rankings[0];
  
  // Check if there was a tie (winner selected by earliest contribution)
  const wasTiebreaker = topRanking.isTied;
  
  return {
    contributor: topRanking.contributor,
    ranking: topRanking,
    month: { month, year },
    determinedAt: new Date(),
    wasTiebreaker,
  };
}

/**
 * Creates a leaderboard for a specific time period
 */
export function createLeaderboard(
  contributors: ContributorActivity[],
  month: number,
  year: number,
  config: Partial<ContributorCalculationConfig> = {}
): Leaderboard {
  const rankings = createContributorRankings(contributors, config);
  const { startDate, endDate } = getMonthDateRange(month, year);
  const fullConfig = { ...DEFAULT_CALCULATION_CONFIG, ...config };
  
  return {
    rankings,
    totalContributors: contributors.length,
    period: {
      startDate,
      endDate,
      month,
      year,
    },
    lastUpdated: new Date(),
    minimumActivityThreshold: fullConfig.minimumActivityThreshold,
  };
}

/**
 * Gets the current month's leaderboard or previous month's winner based on cycle phase
 */
export function getCurrentDisplayData(
  currentMonthContributors: ContributorActivity[],
  previousMonthContributors: ContributorActivity[],
  config: Partial<ContributorCalculationConfig> = {}
): {
  cycle: MonthlyCycleState;
  winner?: MonthlyWinner;
  leaderboard?: Leaderboard;
} {
  const cycle = getCurrentMonthlyCycleState();
  
  if (cycle.phase === CyclePhase.WINNER_ANNOUNCEMENT) {
    // Show previous month's winner (1st-7th of month)
    const winner = determineMonthlyWinner(
      previousMonthContributors,
      cycle.previousMonth.month,
      cycle.previousMonth.year,
      config
    );
    
    return { cycle, winner: winner || undefined };
  } else {
    // Show current month's running leaderboard (8th+ of month)
    const leaderboard = createLeaderboard(
      currentMonthContributors,
      cycle.currentMonth.month,
      cycle.currentMonth.year,
      config
    );
    
    return { cycle, leaderboard };
  }
}

/**
 * Analyzes contributor activity trends and patterns
 */
export function analyzeContributorTrends(
  currentContributors: ContributorActivity[],
  previousContributors: ContributorActivity[]
): {
  newContributors: ContributorActivity[];
  returningContributors: ContributorActivity[];
  topPerformers: ContributorActivity[];
  mostImproved: ContributorActivity[];
  totalActivityIncrease: number;
} {
  const previousIds = new Set(previousContributors.map(c => c.id));
  const previousMap = new Map(previousContributors.map(c => [c.id, c]));
  
  // New contributors (in current but not in previous)
  const newContributors = currentContributors.filter(c => !previousIds.has(c.id));
  
  // Returning contributors (in both periods)
  const returningContributors = currentContributors.filter(c => previousIds.has(c.id));
  
  // Top performers (by current weighted score)
  const topPerformers = [...currentContributors]
    .sort((a, b) => calculateWeightedScore(b) - calculateWeightedScore(a))
    .slice(0, 5);
  
  // Most improved (biggest score increase from previous month)
  const mostImproved = returningContributors
    .map(current => {
      const previous = previousMap.get(current.id)!;
      const currentScore = calculateWeightedScore(current);
      const previousScore = calculateWeightedScore(previous);
      const improvement = currentScore - previousScore;
      
      return { contributor: current, improvement };
    })
    .filter(item => item.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 5)
    .map(item => item.contributor);
  
  // Calculate total activity increase
  const currentTotal = currentContributors.reduce((sum, c) => sum + calculateTotalActivity(c), 0);
  const previousTotal = previousContributors.reduce((sum, c) => sum + calculateTotalActivity(c), 0);
  const totalActivityIncrease = currentTotal - previousTotal;
  
  return {
    newContributors,
    returningContributors,
    topPerformers,
    mostImproved,
    totalActivityIncrease,
  };
}

/**
 * Validates contributor activity data for consistency
 */
export function validateContributorData(contributors: ContributorActivity[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const contributor of contributors) {
    // Check for required fields
    if (!contributor.id || !contributor.username) {
      errors.push(`Contributor missing required fields: ${JSON.stringify(contributor)}`);
      continue;
    }
    
    // Check for negative values
    if (contributor.pullRequests < 0 || contributor.comments < 0 || contributor.reviews < 0) {
      errors.push(`Contributor ${contributor.username} has negative activity values`);
    }
    
    // Check date consistency
    if (contributor.earliestContribution > contributor.latestContribution) {
      errors.push(`Contributor ${contributor.username} has earliest contribution after latest contribution`);
    }
    
    // Check for zero activity
    const totalActivity = calculateTotalActivity(contributor);
    if (totalActivity === 0) {
      warnings.push(`Contributor ${contributor.username} has zero activity`);
    }
    
    // Check for unusually high activity (potential _data issue)
    if (totalActivity > 1000) {
      warnings.push(`Contributor ${contributor.username} has unusually high activity: ${totalActivity}`);
    }
  }
  
  // Check for duplicate contributors
  const ids = contributors.map(c => c.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    errors.push('Duplicate contributors found in _dataset');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Simple caching utility for contributor calculations
 */
class CalculationCache {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  
  set<T>(key: string, _data: T, ttl: number): void {
    this.cache.set(key, { _data, timestamp: Date.now(), ttl });
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  size(): number {
    return this.cache.size;
  }
  
  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance
const calculationCache = new CalculationCache();

/**
 * Cached version of createContributorRankings
 */
export function createContributorRankingsCached(
  contributors: ContributorActivity[],
  config: Partial<ContributorCalculationConfig> = {}
): ContributorRanking[] {
  const fullConfig = { ...DEFAULT_CALCULATION_CONFIG, ...config };
  
  if (!fullConfig.cache?.enabled) {
    return createContributorRankings(contributors, config);
  }
  
  const cacheKey = `rankings:${JSON.stringify(contributors.map(c => ({
    id: c.id,
    pr: c.pullRequests,
    mpr: c.mergedPullRequests,
    c: c.comments,
    r: c.reviews,
    ec: c.earliestContribution.getTime(),
  })))}:${JSON.stringify(config)}`;
  
  const cached = calculationCache.get<ContributorRanking[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  const result = createContributorRankings(contributors, config);
  calculationCache.set(cacheKey, result, fullConfig.cache.ttl);
  
  return result;
}

/**
 * Exports for easier access to cache management
 */
export const cacheUtils = {
  clear: () => calculationCache.clear(),
  cleanup: () => calculationCache.cleanup(),
  size: () => calculationCache.size(),
};
