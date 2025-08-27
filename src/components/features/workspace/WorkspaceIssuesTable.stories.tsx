import type { Meta, StoryObj } from '@storybook/react';
import { WorkspaceIssuesTable, type Issue } from './WorkspaceIssuesTable';

const meta: Meta<typeof WorkspaceIssuesTable> = {
  title: 'Features/Workspace/WorkspaceIssuesTable',
  component: WorkspaceIssuesTable,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    onIssueClick: { action: 'issue-clicked' },
    onRepositoryClick: { action: 'repository-clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Generate mock issue data
const generateMockIssues = (count: number): Issue[] => {
  const states = ['open', 'closed'] as const;
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

  const labels = [
    { name: 'bug', color: 'd73a4a' },
    { name: 'enhancement', color: 'a2eeef' },
    { name: 'documentation', color: '0075ca' },
    { name: 'help wanted', color: '008672' },
    { name: 'good first issue', color: '7057ff' },
    { name: 'question', color: 'd876e3' },
    { name: 'wontfix', color: 'ffffff' },
  ];

  const titles = [
    'Fix memory leak in production build',
    'Add dark mode support',
    'Update documentation for API v2',
    'Improve performance of data fetching',
    'Bug: Navigation breaks on mobile devices',
    'Feature request: Export to CSV functionality',
    'Refactor authentication module',
    'Add unit tests for utility functions',
    'Fix TypeScript compilation errors',
    'Implement real-time notifications',
    'Optimize bundle size',
    'Add support for markdown in comments',
    'Fix accessibility issues in forms',
    'Implement search functionality',
    'Update dependencies to latest versions',
  ];

  return Array.from({ length: count }, (_, i) => {
    const state = states[Math.floor(Math.random() * states.length)];
    const repo = repositories[Math.floor(Math.random() * repositories.length)];
    const author = authors[Math.floor(Math.random() * authors.length)];
    const issueLabels = labels
      .filter(() => Math.random() > 0.6)
      .slice(0, Math.floor(Math.random() * 4) + 1);

    const createdAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);
    const updatedAt = new Date(createdAt.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);
    const closedAt =
      state === 'closed'
        ? new Date(updatedAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

    // Generate linked pull requests (60% chance of having linked PRs)
    const linkedPRs =
      Math.random() > 0.4
        ? Array.from({ length: Math.floor(Math.random() * 4) + 1 }, (_, prIndex) => {
            const prStates = ['open', 'closed', 'merged'] as const;
            const prState = prStates[Math.floor(Math.random() * prStates.length)];
            const prNumber = 2000 + i * 10 + prIndex;
            return {
              number: prNumber,
              url: `https://github.com/${repo.owner}/${repo.name}/pull/${prNumber}`,
              state: prState,
            };
          })
        : undefined;

    return {
      id: `issue-${i + 1}`,
      number: 1000 + i,
      title: titles[i % titles.length],
      state,
      repository: repo,
      author,
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      closed_at: closedAt,
      comments_count: Math.floor(Math.random() * 20),
      labels: issueLabels,
      linked_pull_requests: linkedPRs,
      url: `https://github.com/${repo.owner}/${repo.name}/issues/${1000 + i}`,
    };
  });
};

export const Default: Story = {
  args: {
    issues: generateMockIssues(15),
  },
};

export const Empty: Story = {
  args: {
    issues: [],
  },
};

export const Loading: Story = {
  args: {
    issues: [],
    loading: true,
  },
};

export const WithManyIssues: Story = {
  args: {
    issues: generateMockIssues(50),
  },
};

export const OnlyOpenIssues: Story = {
  args: {
    issues: generateMockIssues(20).map((issue) => ({ ...issue, state: 'open' as const })),
  },
};

export const OnlyClosedIssues: Story = {
  args: {
    issues: generateMockIssues(20).map((issue) => ({
      ...issue,
      state: 'closed' as const,
      closed_at: new Date().toISOString(),
    })),
  },
};

export const WithManyLabels: Story = {
  args: {
    issues: generateMockIssues(10).map((issue) => ({
      ...issue,
      labels: [
        { name: 'bug', color: 'd73a4a' },
        { name: 'enhancement', color: 'a2eeef' },
        { name: 'documentation', color: '0075ca' },
        { name: 'help wanted', color: '008672' },
        { name: 'good first issue', color: '7057ff' },
      ],
    })),
  },
};

export const HighCommentCount: Story = {
  args: {
    issues: generateMockIssues(10).map((issue) => ({
      ...issue,
      comments_count: Math.floor(Math.random() * 50) + 20,
    })),
  },
};

export const WithLinkedPullRequests: Story = {
  name: 'With Linked Pull Requests',
  args: {
    issues: generateMockIssues(10).map((issue, i) => ({
      ...issue,
      linked_pull_requests: [
        {
          number: 3001 + i * 3,
          url: `https://github.com/${issue.repository.owner}/${issue.repository.name}/pull/${3001 + i * 3}`,
          state: 'merged' as const,
        },
        {
          number: 3002 + i * 3,
          url: `https://github.com/${issue.repository.owner}/${issue.repository.name}/pull/${3002 + i * 3}`,
          state: 'open' as const,
        },
        {
          number: 3003 + i * 3,
          url: `https://github.com/${issue.repository.owner}/${issue.repository.name}/pull/${3003 + i * 3}`,
          state: 'closed' as const,
        },
      ],
    })),
  },
};

export const NoLinkedPullRequests: Story = {
  name: 'No Linked Pull Requests',
  args: {
    issues: generateMockIssues(10).map((issue) => ({
      ...issue,
      linked_pull_requests: undefined,
    })),
  },
};
