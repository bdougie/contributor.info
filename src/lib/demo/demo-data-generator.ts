/**
 * Centralized Demo Data Generation
 * This module contains all mock data generation functions for the demo workspace.
 * This is NOT for cryptographic use, only for generating consistent demo data.
 */

import type {
  AnalyticsData,
  ActivityItem,
  ContributorStat,
  RepositoryMetric,
  TrendDataset,
} from '@/components/features/workspace/AnalyticsDashboard';
import type { WorkspaceRepositoryWithDetails } from '@/types/workspace';
import type {
  WorkspaceMetrics,
  Repository,
  ActivityDataPoint,
} from '@/components/features/workspace';

/**
 * Simple deterministic pseudo-random number generator for demo data
 * This is NOT for cryptographic use, only for generating consistent demo data
 */
export function createDemoRandomGenerator(seed: number = 42) {
  let currentSeed = seed;
  return () => {
    currentSeed = (currentSeed * 1103515245 + 12345) % 2147483648;
    return currentSeed / 2147483648;
  };
}

/**
 * Generate comprehensive analytics data for the demo workspace
 */
export function generateDemoAnalyticsData(): AnalyticsData {
  const now = new Date();
  const activities: ActivityItem[] = [];
  const contributors: ContributorStat[] = [];
  const repositories: RepositoryMetric[] = [];

  // Use deterministic random for demo data generation
  const demoRandom = createDemoRandomGenerator();

  // Generate activities
  const activityTypes = ['pr', 'issue', 'commit', 'review'] as const;
  const statuses = ['open', 'merged', 'closed', 'approved'] as const;

  for (let i = 0; i < 200; i++) {
    const createdAt = new Date(now.getTime() - demoRandom() * 30 * 24 * 60 * 60 * 1000);
    activities.push({
      id: `activity-${i}`,
      type: activityTypes[Math.floor(demoRandom() * activityTypes.length)],
      title: `Activity ${i}: ${['Fix bug', 'Add feature', 'Update docs', 'Refactor code'][Math.floor(demoRandom() * 4)]}`,
      author: {
        username: `user${Math.floor(demoRandom() * 20)}`,
        avatar_url: `https://github.com/user${Math.floor(demoRandom() * 20)}.png`,
      },
      repository: ['owner/repo1', 'owner/repo2', 'owner/repo3'][Math.floor(demoRandom() * 3)],
      created_at: createdAt.toISOString(),
      status: statuses[Math.floor(demoRandom() * statuses.length)],
      url: `https://github.com/${['owner/repo1', 'owner/repo2', 'owner/repo3'][Math.floor(demoRandom() * 3)]}/pull/${i}`,
    });
  }

  // Generate contributors
  for (let i = 0; i < 50; i++) {
    const contributions = Math.floor(demoRandom() * 100) + 1;
    contributors.push({
      id: `contributor-${i}`,
      username: `user${i}`,
      avatar_url: `https://github.com/user${i}.png`,
      contributions,
      pull_requests: Math.floor(contributions * 0.4),
      issues: Math.floor(contributions * 0.2),
      reviews: Math.floor(contributions * 0.3),
      commits: Math.floor(contributions * 0.1),
      trend: Math.floor(demoRandom() * 40) - 20,
    });
  }

  // Generate repositories
  const repoNames = ['frontend', 'backend', 'docs', 'mobile', 'api'];
  for (let i = 0; i < 5; i++) {
    repositories.push({
      id: `repo-${i}`,
      name: repoNames[i],
      owner: 'organization',
      stars: Math.floor(demoRandom() * 5000),
      forks: Math.floor(demoRandom() * 1000),
      pull_requests: Math.floor(demoRandom() * 200),
      issues: Math.floor(demoRandom() * 100),
      contributors: Math.floor(demoRandom() * 50) + 10,
      activity_score: Math.floor(demoRandom() * 100),
      trend: Math.floor(demoRandom() * 30) - 15,
    });
  }

  // Generate trend data
  const trends: TrendDataset[] = [];
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(date.toISOString().split('T')[0]);
  }

  trends.push({
    label: 'Pull Requests',
    data: dates.map((date) => ({
      date,
      value: Math.floor(demoRandom() * 50) + 10,
    })),
    color: '#10b981',
  });

  trends.push({
    label: 'Active Contributors',
    data: dates.map((date) => ({
      date,
      value: Math.floor(demoRandom() * 30) + 5,
    })),
    color: '#3b82f6',
  });

  return {
    activities,
    contributors,
    repositories,
    trends,
  };
}

/**
 * Generate mock workspace repositories for the demo workspace
 */
export function generateDemoWorkspaceRepositories(workspaceId: string = 'demo'): WorkspaceRepositoryWithDetails[] {
  return [
    {
      id: 'wr-1',
      workspace_id: workspaceId,
      repository_id: 'repo-1',
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      notes: null,
      tags: [],
      is_pinned: false,
      repository: {
        id: 'repo-1',
        full_name: 'organization/frontend',
        owner: 'organization',
        name: 'frontend',
        description: 'Frontend React application',
        language: 'TypeScript',
        stargazers_count: 1234,
        forks_count: 234,
        open_issues_count: 45,
        topics: ['react', 'typescript'],
        is_private: false,
        is_archived: false,
      },
      added_by_user: {
        id: 'user-1',
        email: 'user@example.com',
        display_name: 'Demo User',
      },
    },
    {
      id: 'wr-2',
      workspace_id: workspaceId,
      repository_id: 'repo-2',
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      notes: null,
      tags: [],
      is_pinned: false,
      repository: {
        id: 'repo-2',
        full_name: 'organization/backend',
        owner: 'organization',
        name: 'backend',
        description: 'Backend API service',
        language: 'Go',
        stargazers_count: 2345,
        forks_count: 345,
        open_issues_count: 67,
        topics: ['golang', 'api'],
        is_private: false,
        is_archived: false,
      },
      added_by_user: {
        id: 'user-1',
        email: 'user@example.com',
        display_name: 'Demo User',
      },
    },
    {
      id: 'wr-3',
      workspace_id: workspaceId,
      repository_id: 'repo-3',
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      notes: null,
      tags: [],
      is_pinned: false,
      repository: {
        id: 'repo-3',
        full_name: 'organization/docs',
        owner: 'organization',
        name: 'docs',
        description: 'Documentation and guides',
        language: 'Markdown',
        stargazers_count: 456,
        forks_count: 56,
        open_issues_count: 12,
        topics: ['documentation'],
        is_private: false,
        is_archived: false,
      },
      added_by_user: {
        id: 'user-1',
        email: 'user@example.com',
        display_name: 'Demo User',
      },
    },
    {
      id: 'wr-4',
      workspace_id: workspaceId,
      repository_id: 'repo-4',
      added_by: 'user-1',
      added_at: new Date().toISOString(),
      notes: null,
      tags: [],
      is_pinned: false,
      repository: {
        id: 'repo-4',
        full_name: 'organization/mobile',
        owner: 'organization',
        name: 'mobile',
        description: 'Mobile application',
        language: 'Swift',
        stargazers_count: 789,
        forks_count: 123,
        open_issues_count: 23,
        topics: ['ios', 'swift'],
        is_private: false,
        is_archived: false,
      },
      added_by_user: {
        id: 'user-1',
        email: 'user@example.com',
        display_name: 'Demo User',
      },
    },
  ];
}

/**
 * Utility function to filter repositories based on selection
 */
const filterRepositoriesBySelection = <T extends { id: string }>(
  repos: T[],
  selectedRepoIds?: string[]
): T[] => {
  if (!selectedRepoIds || selectedRepoIds.length === 0) {
    return repos;
  }
  return repos.filter((repo) => selectedRepoIds.includes(repo.id));
};

/**
 * Generate mock workspace metrics
 */
export function generateDemoWorkspaceMetrics(
  repos: Repository[],
  timeRange: '7d' | '30d' | '90d' | '1y' | 'all',
  selectedRepoIds?: string[]
): WorkspaceMetrics {
  const demoRandom = createDemoRandomGenerator();
  const filteredRepos = filterRepositoriesBySelection(repos, selectedRepoIds);

  const totalStars = filteredRepos.reduce((sum, repo) => sum + (repo.stars || 0), 0);
  const totalContributors = filteredRepos.reduce((sum, repo) => sum + (repo.contributors || 0), 0);

  // Generate time-range aware trend percentages
  const getTimeRangeMultiplier = (range: typeof timeRange): number => {
    switch (range) {
      case '7d': return 1.0;
      case '30d': return 0.7;
      case '90d': return 0.5;
      case '1y': return 0.3;
      case 'all': return 0.2;
      default: return 0.7;
    }
  };

  const multiplier = getTimeRangeMultiplier(timeRange);

  return {
    totalStars,
    totalPRs: Math.floor(demoRandom() * 500) + 100,
    totalContributors,
    totalCommits: Math.floor(demoRandom() * 10000) + 1000,
    starsTrend: (demoRandom() - 0.5) * 20 * multiplier,
    prsTrend: (demoRandom() - 0.5) * 15 * multiplier,
    contributorsTrend: (demoRandom() - 0.5) * 10 * multiplier,
    commitsTrend: (demoRandom() - 0.5) * 25 * multiplier,
  };
}

/**
 * Generate mock workspace trend data
 */
export function generateDemoWorkspaceTrendData(
  days: number,
  repos?: Repository[],
  selectedRepoIds?: string[]
): ActivityDataPoint[] {
  const demoRandom = createDemoRandomGenerator();
  const filteredRepos = repos ? filterRepositoriesBySelection(repos, selectedRepoIds) : [];
  const baseScale = Math.max(1, filteredRepos.length);

  const data: ActivityDataPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    data.push({
      date: date.toISOString().split('T')[0],
      additions: Math.floor(demoRandom() * 200 * baseScale) + baseScale,
      deletions: Math.floor(demoRandom() * 100 * baseScale) + Math.floor(baseScale / 2),
      commits: Math.floor(demoRandom() * 20 * baseScale) + baseScale,
      files_changed: Math.floor(demoRandom() * 10 * baseScale) + Math.floor(baseScale / 3),
    });
  }

  return data;
}

/**
 * Generate demo repositories list
 */
export function generateDemoRepositories(): Repository[] {
  const demoRandom = createDemoRandomGenerator();
  const repoData = [
    { name: 'frontend', description: 'React frontend application', language: 'TypeScript', topics: ['react', 'typescript'] },
    { name: 'backend', description: 'Node.js backend API', language: 'JavaScript', topics: ['nodejs', 'api'] },
    { name: 'mobile', description: 'React Native mobile app', language: 'TypeScript', topics: ['react-native', 'mobile'] },
    { name: 'docs', description: 'Documentation site', language: 'Markdown', topics: ['documentation'] },
    { name: 'infrastructure', description: 'Infrastructure as code', language: 'Terraform', topics: ['terraform', 'aws'] },
  ];

  return repoData.map((repo, index) => ({
    id: `repo-${index + 1}`,
    full_name: `organization/${repo.name}`,
    name: repo.name,
    owner: 'organization',
    description: repo.description,
    language: repo.language,
    stars: Math.floor(demoRandom() * 2000) + 100,
    forks: Math.floor(demoRandom() * 300) + 10,
    open_prs: Math.floor(demoRandom() * 10) + 1,
    open_issues: Math.floor(demoRandom() * 20) + 1,
    contributors: Math.floor(demoRandom() * 50) + 5,
    last_activity: new Date(Date.now() - demoRandom() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    html_url: `https://github.com/organization/${repo.name}`,
  }));
}