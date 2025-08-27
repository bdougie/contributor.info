import type { Meta, StoryObj } from '@storybook/react';
import { MetricsAndTrendsCard } from './metrics-and-trends-card';

// Mock the insights modules to avoid API calls
// TODO: Mock @/lib/insights/trends-metrics using Storybook's approach
// Original vi.mock replaced - needs manual review;

// TODO: Mock @/lib/insights/pr-activity-metrics using Storybook's approach
// Original vi.mock replaced - needs manual review;

const meta = {
  title: 'Features/Activity/MetricsAndTrendsCard',
  component: MetricsAndTrendsCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A comprehensive card that displays key metrics and trends for repository activity, including PR counts, merge times, velocity, and trend analysis.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    owner: {
      control: 'text',
      description: 'Repository owner/organization name',
    },
    repo: {
      control: 'text',
      description: 'Repository name',
    },
    timeRange: {
      control: 'select',
      options: ['30d', '90d', '6m', '1y'],
      description: 'Time range for metrics calculation',
    },
  },
} satisfies Meta<typeof MetricsAndTrendsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
    timeRange: '30d',
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <MetricsAndTrendsCard {...args} />
    </div>
  ),
};

export const LargeRepository: Story = {
  args: {
    owner: 'microsoft',
    repo: 'vscode',
    timeRange: '30d',
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <MetricsAndTrendsCard {...args} />
    </div>
  ),
};

export const LongerTimeRange: Story = {
  args: {
    owner: 'vercel',
    repo: 'next.js',
    timeRange: '90d',
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <MetricsAndTrendsCard {...args} />
    </div>
  ),
};

export const YearlyView: Story = {
  args: {
    owner: 'nodejs',
    repo: 'node',
    timeRange: '1y',
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <MetricsAndTrendsCard {...args} />
    </div>
  ),
};

export const Loading: Story = {
  args: {
    owner: 'loading',
    repo: 'repo',
    timeRange: '30d',
  },
  parameters: {
    msw: {
      handlers: [],
    },
  },
  render: (args) => {
    // Override the mocks to simulate loading state
    // TODO: Mock @/lib/insights/trends-metrics using Storybook's approach
    // Original vi.mock replaced - needs manual review;

    // TODO: Mock @/lib/insights/pr-activity-metrics using Storybook's approach
    // Original vi.mock replaced - needs manual review;

    return (
      <div className="w-[800px] p-4">
        <MetricsAndTrendsCard {...args} />
      </div>
    );
  },
};
