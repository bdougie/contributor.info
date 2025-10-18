export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at?: string | null;
  additions: number;
  deletions: number;
  changed_files?: number;
  repository_owner: string;
  repository_name: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
    organizations_url?: string;
    type?: 'User' | 'Bot'; // Adding type field to track bot status
  };
  html_url?: string;
  organizations?: {
    login: string;
    avatar_url: string;
  }[];
  commits?: Array<{
    language: string;
    additions: number;
    deletions: number;
  }>;
  author?: {
    login: string;
  };
  url?: string;
  createdAt?: string;
  reviews?: Array<{
    id: number;
    state: string;
    user: {
      login: string;
      avatar_url: string;
    };
    submitted_at: string;
  }>;
  requested_reviewers?: Array<{
    id?: number;
    login: string;
    avatar_url?: string;
  }>;
  comments?: Array<{
    id: number;
    user: {
      login: string;
      avatar_url: string;
    };
    created_at: string;
  }>;
}

export interface RepoStats {
  pullRequests: PullRequest[];
  loading: boolean;
  error: string | null;
}

export interface RecentIssue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at?: string;
  repository_owner: string;
  repository_name: string;
  comments_count: number;
  html_url?: string;
}

export interface RecentActivity {
  id: string;
  type: 'pr' | 'issue' | 'commit' | 'review' | 'comment' | 'star' | 'fork' | 'discussion';
  title: string;
  created_at: string;
  status?: string;
  repository: string;
  url?: string;
}

export interface ContributorStats {
  login: string;
  avatar_url: string;
  pullRequests: number;
  percentage: number;
  recentPRs?: PullRequest[];
  recentIssues?: RecentIssue[];
  recentActivities?: RecentActivity[];
  organizations?: {
    login: string;
    avatar_url: string;
  }[];
  // User profile information
  name?: string | null;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
  websiteUrl?: string | null;
}

export interface LotteryFactor {
  topContributorsCount: number;
  totalContributors: number;
  topContributorsPercentage: number;
  contributors: ContributorStats[];
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface QuadrantData {
  name: string;
  authors: {
    id: number;
    login: string;
  }[];
  percentage: number;
  count: number;
}

export interface LanguageStats {
  name: string;
  count: number;
  color: string;
}

export interface YoloCoderStats {
  login: string;
  avatar_url: string;
  directCommits: number;
  totalCommits: number;
  directCommitPercentage: number;
  type?: 'User' | 'Bot';
}

export interface DirectCommitsData {
  hasYoloCoders: boolean;
  yoloCoderStats: YoloCoderStats[];
}

// PR Activity types (moved from src/types/pr-activity.ts)
export type ActivityType =
  | 'opened'
  | 'closed'
  | 'merged'
  | 'reviewed'
  | 'commented'
  | 'starred'
  | 'forked';

export interface User {
  id: string;
  name: string;
  avatar: string;
  isBot?: boolean;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  url: string;
}

export interface PullRequestActivity {
  id: string;
  type: ActivityType;
  user: User;
  pullRequest: {
    id: string | number;
    number: number;
    title: string;
    body?: string;
    state?: string;
    draft?: boolean;
    merged?: boolean;
    mergeable?: boolean | null;
    url: string;
    additions?: number;
    deletions?: number;
    changedFiles?: number;
    commits?: number;
    createdAt?: string;
    updatedAt?: string;
    closedAt?: string | null;
    mergedAt?: string | null;
    // Spam detection fields
    spamScore?: number | null;
    isSpam?: boolean;
    spamFlags?: {
      suspicious_title?: boolean;
      suspicious_body?: boolean;
      suspicious_user?: boolean;
      unusual_activity?: boolean;
      [key: string]: boolean | undefined;
    };
  };
  repository: Repository & {
    fullName?: string;
    private?: boolean;
  };
  timestamp: string;
  createdAt?: Date;
  // Additional metadata for spam detection
  metadata?: {
    spamScore?: number | null;
    isSpam?: boolean;
    spamDetectedAt?: string | null;
  };
}

// Add TimeRange type for use in hooks
export type TimeRange = string;

// Updated QuadrantDistribution type to include both general distribution and detailed breakdown
export interface QuadrantDistribution {
  label: string;
  value: number;
  percentage: number;
  refinement?: number;
  new?: number;
  refactoring?: number;
  maintenance?: number;
}

// Contributor of the Month types
export interface ContributorActivity {
  pullRequests: number;
  reviews: number;
  comments: number;
  totalScore: number;
  firstContributionDate: string;
}

export interface MonthlyContributor {
  login: string;
  avatar_url: string;
  activity: ContributorActivity;
  rank: number;
  isWinner?: boolean;
}

export interface ContributorRanking {
  month: string;
  year: number;
  contributors: MonthlyContributor[];
  winner?: MonthlyContributor;
  phase: 'winner_announcement' | 'running_leaderboard';
}

// Activity weight constants for contributor scoring
export const ACTIVITY_WEIGHTS = {
  PULL_REQUESTS: 1,
  REVIEWS: 3,
  COMMENTS: 3,
} as const;
