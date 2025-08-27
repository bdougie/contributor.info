import type { Meta, StoryObj } from '@storybook/react';
import Distribution from './distribution';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import type { PullRequest } from '@/lib/types';

// Helper function to create mock pull requests for distribution testing
const createMockPR = (
  id: number,
  login: string,
  additions: number,
  deletions: number,
  daysAgo: number,
  title: string
): PullRequest => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id,
    number: id,
    title,
    state: 'closed',
    created_at: date.toISOString(),
    updated_at: date.toISOString(),
    merged_at: date.toISOString(),
    additions,
    deletions,
    repository_owner: 'test-org',
    repository_name: 'test-repo',
    user: {
      id: id,
      login,
      avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
      type: 'User',
    },
    html_url: `https://github.com/test-org/test-repo/pull/${id}`,
    commits: [
      {
        language: 'TypeScript',
        additions,
        deletions,
      },
    ],
  };
};

// Balanced distribution across quadrants
const balancedDataset: PullRequest[] = [
  // Refinement (low additions, high deletions) - 25%
  createMockPR(1, 'refactorer', 10, 50, 1, 'Refactor authentication module'),
  createMockPR(2, 'cleaner', 5, 30, 2, 'Remove unused imports'),
  createMockPR(3, 'optimizer', 15, 40, 3, 'Optimize database queries'),

  // New Feature (high additions, low deletions) - 25%
  createMockPR(4, 'builder', 200, 5, 4, 'Add user dashboard'),
  createMockPR(5, 'creator', 150, 10, 5, 'Implement search functionality'),
  createMockPR(6, 'developer', 180, 8, 6, 'Add notification system'),

  // Major Refactor (high additions, high deletions) - 25%
  createMockPR(7, 'restructurer', 300, 200, 7, 'Restructure API endpoints'),
  createMockPR(8, 'modernizer', 250, 180, 8, 'Migrate to new framework'),
  createMockPR(9, 'transformer', 400, 250, 9, 'Convert to TypeScript'),

  // Maintenance (low additions, low deletions) - 25%
  createMockPR(10, 'maintainer', 20, 15, 10, 'Update dependencies'),
  createMockPR(11, 'fixer', 25, 10, 11, 'Fix minor UI bugs'),
  createMockPR(12, 'updater', 30, 20, 12, 'Update documentation'),
];

// Skewed towards new features
const newFeatureHeavyDataset: PullRequest[] = [
  createMockPR(1, 'feature1', 300, 10, 1, 'Add payment system'),
  createMockPR(2, 'feature2', 250, 15, 2, 'Add user profiles'),
  createMockPR(3, 'feature3', 400, 20, 3, 'Add chat functionality'),
  createMockPR(4, 'feature4', 180, 8, 4, 'Add file upload'),
  createMockPR(5, 'feature5', 320, 12, 5, 'Add analytics dashboard'),
  createMockPR(6, 'small1', 20, 5, 6, 'Minor bug fix'),
  createMockPR(7, 'small2', 15, 10, 7, 'Update README'),
];

// Maintenance heavy dataset
const maintenanceHeavyDataset: PullRequest[] = [
  createMockPR(1, 'maint1', 5, 2, 1, 'Fix typo'),
  createMockPR(2, 'maint2', 10, 5, 2, 'Update config'),
  createMockPR(3, 'maint3', 15, 8, 3, 'Bump version'),
  createMockPR(4, 'maint4', 8, 3, 4, 'Fix linting'),
  createMockPR(5, 'maint5', 12, 6, 5, 'Update tests'),
  createMockPR(6, 'big1', 200, 50, 6, 'Add new feature'),
];

// Refactoring heavy dataset
const refactoringHeavyDataset: PullRequest[] = [
  createMockPR(1, 'refactor1', 50, 200, 1, 'Remove legacy code'),
  createMockPR(2, 'refactor2', 30, 150, 2, 'Simplify API'),
  createMockPR(3, 'refactor3', 80, 300, 3, 'Clean up components'),
  createMockPR(4, 'refactor4', 25, 100, 4, 'Remove duplicates'),
  createMockPR(5, 'refactor5', 40, 180, 5, 'Optimize imports'),
  createMockPR(6, 'feature1', 200, 10, 6, 'Add small feature'),
];

const emptyDataset: PullRequest[] = [];

const meta = {
  title: 'Components/Distribution',
  component: Distribution,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A visualization showing the distribution of pull requests across different categories (refinement, new features, refactoring, maintenance).',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Distribution>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balanced: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: balancedDataset, loading: false, error: null },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[600px] h-[500px] p-4">
        <Distribution />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const NewFeatureHeavy: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: newFeatureHeavyDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[600px] h-[500px] p-4">
        <Distribution />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const MaintenanceHeavy: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: maintenanceHeavyDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[600px] h-[500px] p-4">
        <Distribution />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const RefactoringHeavy: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: refactoringHeavyDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[600px] h-[500px] p-4">
        <Distribution />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const Loading: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: [], loading: true, error: null },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[600px] h-[500px] p-4">
        <Distribution />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const Error: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: [],
          loading: false,
          error: 'Failed to load distribution data',
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[600px] h-[500px] p-4">
        <Distribution />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const EmptyData: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: emptyDataset, loading: false, error: null },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[600px] h-[500px] p-4">
        <Distribution />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const SingleContributor: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: [
            createMockPR(1, 'solodev', 100, 20, 1, 'Solo contribution'),
            createMockPR(2, 'solodev', 50, 50, 2, 'Another solo work'),
            createMockPR(3, 'solodev', 200, 10, 3, 'Major feature'),
          ],
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[600px] h-[500px] p-4">
        <Distribution />
      </div>
    </RepoStatsContext.Provider>
  ),
};
