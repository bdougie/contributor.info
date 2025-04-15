export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  repository_owner: string;
  repository_name: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
    organizations_url?: string;
  };
  organizations?: {
    login: string;
    avatar_url: string;
  }[];
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