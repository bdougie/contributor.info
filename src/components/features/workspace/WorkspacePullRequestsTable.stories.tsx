import type { Meta, StoryObj } from '@storybook/react';
import { WorkspacePullRequestsTable, type PullRequest } from './WorkspacePullRequestsTable';

const meta: Meta<typeof WorkspacePullRequestsTable> = {
  title: 'Features/Workspace/WorkspacePullRequestsTable',
  component: WorkspacePullRequestsTable,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    onPullRequestClick: { action: 'pr-clicked' },
    onRepositoryClick: { action: 'repository-clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Generate mock PR data
const generateMockPullRequests = (count: number): PullRequest[] => {
  const states = ['open', 'closed', 'merged', 'draft'] as const;
  const repositories = [
    { owner: 'microsoft', name: 'vscode', avatar_url: 'https://github.com/microsoft.png' },
    { owner: 'facebook', name: 'react', avatar_url: 'https://github.com/facebook.png' },
    { owner: 'vercel', name: 'next.js', avatar_url: 'https://github.com/vercel.png' },
    { owner: 'vuejs', name: 'vue', avatar_url: 'https://github.com/vuejs.png' },
    { owner: 'angular', name: 'angular', avatar_url: 'https://github.com/angular.png' },
  ];
  
  const authors = [
    { username: 'alice', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
    { username: 'bob', avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4' },
    { username: 'charlie', avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4' },
    { username: 'diana', avatar_url: 'https://avatars.githubusercontent.com/u/4?v=4' },
    { username: 'eve', avatar_url: 'https://avatars.githubusercontent.com/u/5?v=4' },
  ];

  const reviewers = [
    { username: 'reviewer1', avatar_url: 'https://avatars.githubusercontent.com/u/10?v=4', approved: true },
    { username: 'reviewer2', avatar_url: 'https://avatars.githubusercontent.com/u/11?v=4', approved: false },
    { username: 'reviewer3', avatar_url: 'https://avatars.githubusercontent.com/u/12?v=4', approved: true },
    { username: 'reviewer4', avatar_url: 'https://avatars.githubusercontent.com/u/13?v=4', approved: false },
    { username: 'reviewer5', avatar_url: 'https://avatars.githubusercontent.com/u/14?v=4', approved: true },
  ];

  const labels = [
    { name: 'feature', color: '0e8a16' },
    { name: 'bugfix', color: 'd73a4a' },
    { name: 'enhancement', color: 'a2eeef' },
    { name: 'documentation', color: '0075ca' },
    { name: 'dependencies', color: '0366d6' },
    { name: 'breaking change', color: 'e99695' },
    { name: 'performance', color: 'fbca04' },
  ];

  const titles = [
    'feat: Add new dashboard component',
    'fix: Resolve memory leak in production',
    'chore: Update dependencies',
    'docs: Improve API documentation',
    'perf: Optimize bundle size',
    'refactor: Modernize authentication flow',
    'test: Add unit tests for utilities',
    'style: Format code with Prettier',
    'fix: Handle edge case in data fetching',
    'feat: Implement real-time notifications',
    'build: Update webpack configuration',
    'ci: Add GitHub Actions workflow',
    'feat: Add dark mode support',
    'fix: Correct TypeScript types',
    'docs: Add contribution guidelines',
  ];

  return Array.from({ length: count }, (_, i) => {
    const state = states[Math.floor(Math.random() * states.length)];
    const repo = repositories[Math.floor(Math.random() * repositories.length)];
    const author = authors[Math.floor(Math.random() * authors.length)];
    const prLabels = labels
      .filter(() => Math.random() > 0.6)
      .slice(0, Math.floor(Math.random() * 3) + 1);
    
    const prReviewers = reviewers
      .filter(() => Math.random() > 0.5)
      .slice(0, Math.floor(Math.random() * 4) + 1)
      .map(r => ({ ...r, approved: Math.random() > 0.4 }));

    const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const updatedAt = new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
    const closedAt = (state === 'closed' || state === 'merged')
      ? new Date(updatedAt.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const mergedAt = state === 'merged'
      ? closedAt
      : undefined;

    return {
      id: `pr-${i + 1}`,
      number: 2000 + i,
      title: titles[i % titles.length],
      state,
      repository: repo,
      author,
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      closed_at: closedAt,
      merged_at: mergedAt,
      comments_count: Math.floor(Math.random() * 15),
      commits_count: Math.floor(Math.random() * 10) + 1,
      additions: Math.floor(Math.random() * 500),
      deletions: Math.floor(Math.random() * 200),
      changed_files: Math.floor(Math.random() * 20) + 1,
      labels: prLabels,
      reviewers: prReviewers,
      url: `https://github.com/${repo.owner}/${repo.name}/pull/${2000 + i}`,
    };
  });
};

export const Default: Story = {
  args: {
    pullRequests: generateMockPullRequests(15),
  },
};

export const Empty: Story = {
  args: {
    pullRequests: [],
  },
};

export const Loading: Story = {
  args: {
    pullRequests: [],
    loading: true,
  },
};

export const WithManyPRs: Story = {
  args: {
    pullRequests: generateMockPullRequests(50),
  },
};

export const OnlyOpenPRs: Story = {
  args: {
    pullRequests: generateMockPullRequests(20).map(pr => ({ ...pr, state: 'open' as const })),
  },
};

export const OnlyMergedPRs: Story = {
  args: {
    pullRequests: generateMockPullRequests(20).map(pr => ({ 
      ...pr, 
      state: 'merged' as const,
      merged_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
    })),
  },
};

export const DraftPRs: Story = {
  args: {
    pullRequests: generateMockPullRequests(10).map(pr => ({ 
      ...pr, 
      state: 'draft' as const,
      reviewers: [], // Draft PRs typically don't have reviewers yet
    })),
  },
};

export const WithManyReviewers: Story = {
  args: {
    pullRequests: generateMockPullRequests(10).map(pr => ({
      ...pr,
      reviewers: [
        { username: 'alice', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', approved: true },
        { username: 'bob', avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4', approved: true },
        { username: 'charlie', avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4', approved: false },
        { username: 'diana', avatar_url: 'https://avatars.githubusercontent.com/u/4?v=4', approved: false },
        { username: 'eve', avatar_url: 'https://avatars.githubusercontent.com/u/5?v=4', approved: true },
      ],
    })),
  },
};

export const LargeChanges: Story = {
  args: {
    pullRequests: generateMockPullRequests(10).map(pr => ({
      ...pr,
      additions: Math.floor(Math.random() * 5000) + 1000,
      deletions: Math.floor(Math.random() * 3000) + 500,
      changed_files: Math.floor(Math.random() * 50) + 20,
    })),
  },
};