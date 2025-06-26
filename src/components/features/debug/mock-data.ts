import type { RepoStats, LotteryFactor, ContributorRanking, MonthlyContributor } from "@/lib/types";
import type { QuadrantData } from "@/hooks/use-distribution";

// Mock data for testing shareable charts
export const mockRepoStats: RepoStats = {
  pullRequests: [
    {
      id: 1,
      number: 1,
      title: "Add new authentication system",
      user: { id: 1, login: "alice-dev", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4", type: "User" },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      merged_at: "2024-01-02T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 450,
      deletions: 80
    },
    {
      id: 2,
      number: 2,
      title: "Fix critical security vulnerability",
      user: { id: 1, login: "alice-dev", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4", type: "User" },
      created_at: "2024-01-03T00:00:00Z",
      updated_at: "2024-01-04T00:00:00Z",
      merged_at: "2024-01-04T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 120,
      deletions: 45
    },
    {
      id: 3,
      number: 3,
      title: "Implement user dashboard",
      user: { id: 2, login: "bob-maintainer", avatar_url: "https://avatars.githubusercontent.com/u/2?v=4", type: "User" },
      created_at: "2024-01-05T00:00:00Z",
      updated_at: "2024-01-06T00:00:00Z",
      merged_at: "2024-01-06T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 320,
      deletions: 25
    },
    {
      id: 4,
      number: 4,
      title: "Add unit tests for core modules",
      user: { id: 3, login: "charlie-qa", avatar_url: "https://avatars.githubusercontent.com/u/3?v=4", type: "User" },
      created_at: "2024-01-07T00:00:00Z",
      updated_at: "2024-01-08T00:00:00Z",
      merged_at: "2024-01-08T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 280,
      deletions: 15
    },
    {
      id: 5,
      number: 5,
      title: "Refactor database layer",
      user: { id: 2, login: "bob-maintainer", avatar_url: "https://avatars.githubusercontent.com/u/2?v=4", type: "User" },
      created_at: "2024-01-09T00:00:00Z",
      updated_at: "2024-01-10T00:00:00Z",
      merged_at: "2024-01-10T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 180,
      deletions: 220
    },
    {
      id: 6,
      number: 6,
      title: "Update documentation",
      user: { id: 4, login: "diana-docs", avatar_url: "https://avatars.githubusercontent.com/u/4?v=4", type: "User" },
      created_at: "2024-01-11T00:00:00Z",
      updated_at: "2024-01-12T00:00:00Z",
      merged_at: "2024-01-12T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 95,
      deletions: 30
    },
    {
      id: 7,
      number: 7,
      title: "Optimize performance bottlenecks",
      user: { id: 1, login: "alice-dev", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4", type: "User" },
      created_at: "2024-01-13T00:00:00Z",
      updated_at: "2024-01-14T00:00:00Z",
      merged_at: "2024-01-14T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 150,
      deletions: 75
    },
    {
      id: 8,
      number: 8,
      title: "Add API rate limiting",
      user: { id: 5, login: "eve-backend", avatar_url: "https://avatars.githubusercontent.com/u/5?v=4", type: "User" },
      created_at: "2024-01-15T00:00:00Z",
      updated_at: "2024-01-16T00:00:00Z",
      merged_at: "2024-01-16T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 85,
      deletions: 12
    }
  ],
  loading: false,
  error: null
};

export const mockLotteryFactor: LotteryFactor = {
  topContributorsCount: 2,
  topContributorsPercentage: 68,
  riskLevel: "High" as const,
  totalContributors: 5,
  contributors: [
    {
      login: "alice-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      pullRequests: 4,
      percentage: 50
    },
    {
      login: "bob-maintainer", 
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
      pullRequests: 2,
      percentage: 25
    },
    {
      login: "charlie-qa",
      avatar_url: "https://avatars.githubusercontent.com/u/3?v=4", 
      pullRequests: 1,
      percentage: 12.5
    },
    {
      login: "diana-docs",
      avatar_url: "https://avatars.githubusercontent.com/u/4?v=4", 
      pullRequests: 1,
      percentage: 12.5
    }
  ]
};

export const mockQuadrantData: QuadrantData[] = [
  {
    id: "refinement",
    label: "Refinement",
    value: 35,
    percentage: 35,
    color: "#4ade80",
    description: "Small, focused improvements and optimizations"
  },
  {
    id: "new",
    label: "New Features", 
    value: 28,
    percentage: 28,
    color: "#60a5fa",
    description: "Brand new functionality and capabilities"
  },
  {
    id: "refactoring",
    label: "Refactoring",
    value: 22,
    percentage: 22,
    color: "#f97316", 
    description: "Code restructuring and architecture improvements"
  },
  {
    id: "maintenance",
    label: "Maintenance",
    value: 15,
    percentage: 15,
    color: "#a78bfa",
    description: "Bug fixes, security updates, and dependency management"
  }
];

// Mock self-selection data
export const mockSelfSelectionStats = {
  external_contribution_rate: 35.7,
  internal_contribution_rate: 64.3,
  external_contributors: 8,
  internal_contributors: 3,
  total_contributors: 11,
  external_prs: 15,
  internal_prs: 27,
  total_prs: 42,
  analysis_period_days: 30
};

// Mock contributor of the month data
export const mockMonthlyContributors: MonthlyContributor[] = [
  {
    login: "alice-dev",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    activity: {
      pullRequests: 8,
      reviews: 12,
      comments: 15,
      totalScore: 47,
      firstContributionDate: "2024-01-03T00:00:00Z"
    },
    rank: 1,
    isWinner: true
  },
  {
    login: "bob-maintainer",
    avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
    activity: {
      pullRequests: 5,
      reviews: 8,
      comments: 12,
      totalScore: 41,
      firstContributionDate: "2024-01-01T00:00:00Z"
    },
    rank: 2
  },
  {
    login: "charlie-qa",
    avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
    activity: {
      pullRequests: 6,
      reviews: 4,
      comments: 8,
      totalScore: 30,
      firstContributionDate: "2024-01-05T00:00:00Z"
    },
    rank: 3
  },
  {
    login: "diana-docs",
    avatar_url: "https://avatars.githubusercontent.com/u/4?v=4",
    activity: {
      pullRequests: 3,
      reviews: 6,
      comments: 5,
      totalScore: 36,
      firstContributionDate: "2024-01-07T00:00:00Z"
    },
    rank: 4
  },
  {
    login: "eve-backend",
    avatar_url: "https://avatars.githubusercontent.com/u/5?v=4",
    activity: {
      pullRequests: 4,
      reviews: 3,
      comments: 7,
      totalScore: 34,
      firstContributionDate: "2024-01-12T00:00:00Z"
    },
    rank: 5
  },
  {
    login: "frank-frontend",
    avatar_url: "https://avatars.githubusercontent.com/u/6?v=4",
    activity: {
      pullRequests: 2,
      reviews: 5,
      comments: 6,
      totalScore: 33,
      firstContributionDate: "2024-01-08T00:00:00Z"
    },
    rank: 6
  },
  {
    login: "grace-designer",
    avatar_url: "https://avatars.githubusercontent.com/u/7?v=4",
    activity: {
      pullRequests: 3,
      reviews: 2,
      comments: 8,
      totalScore: 29,
      firstContributionDate: "2024-01-15T00:00:00Z"
    },
    rank: 7
  },
  {
    login: "henry-intern",
    avatar_url: "https://avatars.githubusercontent.com/u/8?v=4",
    activity: {
      pullRequests: 1,
      reviews: 3,
      comments: 4,
      totalScore: 22,
      firstContributionDate: "2024-01-20T00:00:00Z"
    },
    rank: 8
  }
];

export const mockContributorRankingWinner: ContributorRanking = {
  month: "January",
  year: 2024,
  contributors: mockMonthlyContributors,
  winner: mockMonthlyContributors[0],
  phase: "winner_announcement"
};

export const mockContributorRankingLeaderboard: ContributorRanking = {
  month: "February",
  year: 2024,
  contributors: mockMonthlyContributors.map(c => ({ ...c, isWinner: false })),
  phase: "running_leaderboard"
};