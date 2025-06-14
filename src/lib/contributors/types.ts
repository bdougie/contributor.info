/**
 * TypeScript interfaces and types for contributor tracking and ranking
 */

// Activity weight constants as defined in the PRD
export const ACTIVITY_WEIGHTS = {
  COMMENTS: 3,
  REVIEWS: 3,
  PULL_REQUESTS: 1,
} as const;

// Type for activity weight keys
export type ActivityType = keyof typeof ACTIVITY_WEIGHTS;

/**
 * Raw activity data for a contributor in a specific time period
 */
export interface ContributorActivity {
  /** Unique identifier for the contributor (GitHub user ID) */
  id: string;
  /** GitHub username */
  username: string;
  /** Display name (GitHub name or fallback to username) */
  displayName: string;
  /** Avatar URL from GitHub */
  avatarUrl: string;
  /** Profile URL on GitHub */
  profileUrl: string;
  /** Number of pull requests created (total) */
  pullRequests: number;
  /** Number of pull requests that were merged */
  mergedPullRequests: number;
  /** Number of comments made (on PRs, issues, reviews) */
  comments: number;
  /** Number of reviews submitted */
  reviews: number;
  /** Date of earliest contribution in the period */
  earliestContribution: Date;
  /** Date of latest contribution in the period */
  latestContribution: Date;
  /** Total number of repositories contributed to */
  repositoriesContributed: number;
}

/**
 * Calculated ranking result for a contributor
 */
export interface ContributorRanking {
  /** Contributor basic information */
  contributor: ContributorActivity;
  /** Calculated weighted score */
  weightedScore: number;
  /** Rank position (1-based) */
  rank: number;
  /** Breakdown of score calculation */
  scoreBreakdown: {
    pullRequestsScore: number;
    mergedPullRequestsScore: number;
    commentsScore: number;
    reviewsScore: number;
  };
  /** Whether this contributor is tied with others at the same rank */
  isTied: boolean;
}

/**
 * Monthly cycle phases for contributor display
 */
export enum CyclePhase {
  /** 1st-7th: Display previous month's winner */
  WINNER_ANNOUNCEMENT = 'winner_announcement',
  /** 8th onwards: Display current month's running leaderboard */
  RUNNING_LEADERBOARD = 'running_leaderboard',
}

/**
 * Monthly cycle state information
 */
export interface MonthlyCycleState {
  /** Current phase of the monthly cycle */
  phase: CyclePhase;
  /** Current month and year */
  currentMonth: {
    month: number; // 0-11 (JavaScript Date month)
    year: number;
  };
  /** Previous month and year (for winner display) */
  previousMonth: {
    month: number;
    year: number;
  };
  /** Day of the month (1-31) */
  dayOfMonth: number;
  /** Whether we're in the transition period */
  isTransitioning: boolean;
}

/**
 * Winner data for a specific month
 */
export interface MonthlyWinner {
  /** The winning contributor */
  contributor: ContributorActivity;
  /** Final ranking data */
  ranking: ContributorRanking;
  /** Month and year this contributor won */
  month: {
    month: number;
    year: number;
  };
  /** Date when winner was determined */
  determinedAt: Date;
  /** Whether there was a tie (winner selected by earliest contribution) */
  wasTiebreaker: boolean;
}

/**
 * Leaderboard display data
 */
export interface Leaderboard {
  /** List of ranked contributors */
  rankings: ContributorRanking[];
  /** Total number of active contributors */
  totalContributors: number;
  /** Period this leaderboard covers */
  period: {
    startDate: Date;
    endDate: Date;
    month: number;
    year: number;
  };
  /** When this leaderboard was last calculated */
  lastUpdated: Date;
  /** Minimum activity threshold used */
  minimumActivityThreshold: number;
}

/**
 * Complete contributor feature state
 */
export interface ContributorFeatureState {
  /** Current monthly cycle information */
  cycle: MonthlyCycleState;
  /** Current month's winner (if in winner announcement phase) */
  currentWinner?: MonthlyWinner;
  /** Current leaderboard (if in running leaderboard phase) */
  currentLeaderboard?: Leaderboard;
  /** Loading states */
  isLoading: boolean;
  /** Error state */
  error?: string;
  /** Last time data was refreshed */
  lastRefresh: Date;
}

/**
 * Repository filter options for contributor calculations
 */
export interface RepositoryFilter {
  /** Specific repositories to include (if empty, includes all) */
  includeRepositories?: string[];
  /** Repositories to exclude */
  excludeRepositories?: string[];
  /** Only include repositories with minimum stars */
  minimumStars?: number;
  /** Only include repositories that are not forks */
  excludeForks?: boolean;
}

/**
 * API response wrapper for contributor data
 */
export interface ContributorApiResponse<T> {
  /** Response data */
  data: T;
  /** Success status */
  success: boolean;
  /** Error message if success is false */
  error?: string;
  /** Metadata about the response */
  metadata: {
    /** Total items available (for pagination) */
    total: number;
    /** Page information */
    page?: number;
    /** Items per page */
    limit?: number;
    /** Time taken to process request (ms) */
    processingTime: number;
    /** Whether data was served from cache */
    fromCache: boolean;
  };
}

/**
 * Cache configuration for contributor calculations
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Cache key prefix */
  keyPrefix: string;
  /** Whether to enable cache */
  enabled: boolean;
  /** Maximum cache size (number of entries) */
  maxSize?: number;
}

/**
 * Configuration options for contributor calculations
 */
export interface ContributorCalculationConfig {
  /** Repository filters to apply */
  repositoryFilter?: RepositoryFilter;
  /** Cache configuration */
  cache?: CacheConfig;
  /** Minimum activity threshold to be included in rankings */
  minimumActivityThreshold: number;
  /** Maximum number of contributors to include in leaderboard */
  maxLeaderboardSize: number;
  /** Whether to include inactive contributors */
  includeInactiveContributors: boolean;
}
