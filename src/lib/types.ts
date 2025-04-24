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