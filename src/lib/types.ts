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

export interface ContributorStats {
  login: string;
  avatar_url: string;
  pullRequests: number;
  percentage: number;
  recentPRs?: PullRequest[];
  organizations?: {
    login: string;
    avatar_url: string;
  }[];
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
  totalPushedCommits: number;
  type?: 'User' | 'Bot';
}

export interface DirectCommitsData {
  hasYoloCoders: boolean;
  yoloCoderStats: YoloCoderStats[];
}

// PR Activity types (moved from src/types/pr-activity.ts)
export type ActivityType = 'opened' | 'closed' | 'merged' | 'reviewed' | 'commented';

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
    id: string;
    number: number;
    title: string;
    url: string;
  };
  repository: Repository;
  timestamp: string;
  createdAt: Date;
}

// Add TimeRange type for use in hooks
export type TimeRange = string;

// Updated QuadrantDistribution type to include both general distribution and detailed breakdown
export interface QuadrantDistribution {
  label: string;
  value: number;
  percentage: number;
  refinement?: number;
  newStuff?: number;
  refactoring?: number;
  maintenance?: number;
}

// Supabase Database Types
export interface Database {
  public: {
    Tables: {
      github_activity_cache: {
        Row: {
          repo: string;
          activity_data: PullRequestActivity[];
          updated_at: string;
        };
        Insert: {
          repo: string;
          activity_data: PullRequestActivity[];
          updated_at?: string;
        };
        Update: {
          repo?: string;
          activity_data?: PullRequestActivity[];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, {
      Row: Record<string, unknown>;
      Relationships: [];
    }>;
    Functions: Record<string, {
      Args: Record<string, unknown>;
      Returns: unknown;
    }>;
  };
}