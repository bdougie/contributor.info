import type { Meta, StoryObj } from '@storybook/react';
import { TrendingRepositoryCard } from './TrendingRepositoryCard';
import type { TrendingRepositoryData } from './TrendingRepositoryCard';

const meta = {
  title: 'Features/Trending/TrendingRepositoryCard',
  component: TrendingRepositoryCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A card component for displaying trending repository information with metric changes and trending indicators.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showDataFreshness: {
      control: 'boolean',
    },
    compact: {
      control: 'boolean',
    },
    className: {
      control: 'text',
    },
  },
} satisfies Meta<typeof TrendingRepositoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockTrendingRepo: TrendingRepositoryData = {
  id: 'repo-1',
  owner: 'continuedev',
  name: 'continue',
  description:
    'The open-source autopilot for software development—bring the power of ChatGPT to VS Code',
  language: 'TypeScript',
  stars: 15240,
  trending_score: 87.5,
  star_change: 25.3,
  pr_change: 45.2,
  contributor_change: 15.8,
  last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  avatar_url: 'https://github.com/continuedev.png',
  html_url: 'https://github.com/continuedev/continue',
};

const highTrendingRepo: TrendingRepositoryData = {
  id: 'repo-2',
  owner: 'microsoft',
  name: 'typescript',
  description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output.',
  language: 'TypeScript',
  stars: 98450,
  trending_score: 156.2,
  star_change: 89.7,
  pr_change: 67.4,
  contributor_change: 23.1,
  last_activity: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
  avatar_url: 'https://github.com/microsoft.png',
  html_url: 'https://github.com/microsoft/typescript',
};

const mixedChangesRepo: TrendingRepositoryData = {
  id: 'repo-3',
  owner: 'vercel',
  name: 'ai',
  description: 'Build AI-powered applications with React, Svelte, Vue, and Solid',
  language: 'TypeScript',
  stars: 8920,
  trending_score: 42.3,
  star_change: 15.2,
  pr_change: -8.5, // Negative change
  contributor_change: 12.3,
  last_activity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
  avatar_url: 'https://github.com/vercel.png',
  html_url: 'https://github.com/vercel/ai',
};

const minimalRepo: TrendingRepositoryData = {
  id: 'repo-4',
  owner: 'user',
  name: 'simple-project',
  description: undefined,
  language: undefined,
  stars: 42,
  trending_score: 15.8,
  star_change: 5.2,
  pr_change: 0, // No change
  contributor_change: 0,
  last_activity: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
  avatar_url: undefined,
  html_url: 'https://github.com/user/simple-project',
};

export const Default: Story = {
  args: {
    repository: mockTrendingRepo,
    showDataFreshness: true,
    compact: false,
  },
};

export const HighTrending: Story = {
  args: {
    repository: highTrendingRepo,
    showDataFreshness: true,
    compact: false,
  },
};

export const MixedChanges: Story = {
  args: {
    repository: mixedChangesRepo,
    showDataFreshness: true,
    compact: false,
  },
};

export const Compact: Story = {
  args: {
    repository: mockTrendingRepo,
    showDataFreshness: true,
    compact: true,
  },
};

export const NoDataFreshness: Story = {
  args: {
    repository: mockTrendingRepo,
    showDataFreshness: false,
    compact: false,
  },
};

export const MinimalData: Story = {
  args: {
    repository: minimalRepo,
    showDataFreshness: true,
    compact: false,
  },
};

export const CompactHighTrending: Story = {
  args: {
    repository: highTrendingRepo,
    showDataFreshness: false,
    compact: true,
  },
};

export const NoMetricChanges: Story = {
  args: {
    repository: {
      ...mockTrendingRepo,
      star_change: 0,
      pr_change: 0,
      contributor_change: 0,
    },
    showDataFreshness: true,
    compact: false,
  },
};

export const LongDescription: Story = {
  args: {
    repository: {
      ...mockTrendingRepo,
      name: 'very-long-repository-name-that-should-truncate',
      description:
        'This is a very long description that should demonstrate how the component handles text overflow and line clamping behavior in the card layout. It contains multiple sentences to test the line-clamp-2 functionality.',
    },
    showDataFreshness: true,
    compact: false,
  },
};

export const NegativeChanges: Story = {
  args: {
    repository: {
      ...mockTrendingRepo,
      star_change: -12.5,
      pr_change: -25.3,
      contributor_change: -5.8,
      trending_score: 8.2,
    },
    showDataFreshness: true,
    compact: false,
  },
};

// Responsive stories
export const Mobile: Story = {
  args: {
    repository: mockTrendingRepo,
    showDataFreshness: true,
    compact: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const Tablet: Story = {
  args: {
    repository: mockTrendingRepo,
    showDataFreshness: true,
    compact: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};
