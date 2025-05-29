import type { TimeRange } from './time-range';

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
    type?: 'User' | 'Bot';
  };
  html_url?: string;
  organizations?: Organization[];
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
  files?: Array<{
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
    status: string;
    raw_url: string;
    language?: string;
  }>;
}

export interface Organization {
  id: number;
  login: string;
  avatar_url: string;
  description?: string;
  url: string;
}

export interface OrganizationMember {
  login: string;
  id: number;
  avatar_url: string;
  role: 'admin' | 'member';
  organization: Organization;
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  description?: string;
  privacy: 'secret' | 'closed' | 'visible';
  organization: Organization;
}

export interface RepositoryCollaborator {
  login: string;
  id: number;
  avatar_url: string;
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
  role_name: string;
}

export interface ContributorStats {
  login: string;
  avatar_url: string;
  pullRequests: number;
  percentage: number;
  recentPRs?: PullRequest[];
  organizations?: Organization[];
  role?: 'maintainer' | 'member' | 'contributor';
  permissions?: RepositoryCollaborator['permissions'];
  organizationMemberships?: OrganizationMember[];
  teamMemberships?: Team[];
  totalCommits?: number;
  commitFrequency?: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface RepoStats {
  pullRequests: PullRequest[];
  loading: boolean;
  error: string | null;
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

export interface QuadrantDistribution {
  label: string;
  value: number;
  percentage: number;
  refinement?: number;
  newStuff?: number;
  refactoring?: number;
  maintenance?: number;
}