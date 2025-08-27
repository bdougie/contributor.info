import type { Meta, StoryObj } from '@storybook/react';
import { MetricCard, MetricCardSkeleton } from './MetricCard';
import { Users, GitPullRequest, Star, GitFork } from '@/components/ui/icon';

const meta = {
  title: 'Features/Workspace/MetricCard',
  component: MetricCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A metric card component for displaying workspace statistics with optional trends and icons.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'The title of the metric',
    },
    value: {
      control: 'text',
      description: 'The metric value to display',
    },
    format: {
      control: 'select',
      options: ['number', 'percentage', 'compact'],
      description: 'How to format the value',
    },
    color: {
      control: 'select',
      options: ['blue', 'green', 'orange', 'purple', 'gray'],
      description: 'Color theme for the icon',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading skeleton',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ minWidth: '250px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Total Pull Requests',
    value: 1234,
    icon: <GitPullRequest className="h-4 w-4" />,
    color: 'green',
  },
};

export const WithPositiveTrend: Story = {
  args: {
    title: 'Total Contributors',
    value: 567,
    icon: <Users className="h-4 w-4" />,
    trend: {
      value: 12.5,
      label: 'vs last month',
    },
    color: 'blue',
  },
};

export const WithNegativeTrend: Story = {
  args: {
    title: 'Open Issues',
    value: 89,
    trend: {
      value: -8.3,
      label: 'vs last week',
    },
    color: 'orange',
  },
};

export const CompactFormat: Story = {
  args: {
    title: 'Total Stars',
    value: 15234,
    icon: <Star className="h-4 w-4" />,
    format: 'compact',
    trend: {
      value: 5.2,
    },
    color: 'purple',
  },
};

export const PercentageFormat: Story = {
  args: {
    title: 'Merge Rate',
    value: 87.5,
    format: 'percentage',
    trend: {
      value: 3.2,
      label: 'improvement',
    },
    color: 'green',
  },
};

export const NoIcon: Story = {
  args: {
    title: 'Active Repositories',
    value: 24,
    trend: {
      value: 0,
      label: 'no change',
    },
  },
};

export const Loading: Story = {
  args: {
    title: 'Loading Metric',
    value: 0,
    loading: true,
  },
};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total PRs"
        value={3456}
        icon={<GitPullRequest className="h-4 w-4" />}
        trend={{ value: 12.5, label: 'vs last month' }}
        color="green"
      />
      <MetricCard
        title="Contributors"
        value={234}
        icon={<Users className="h-4 w-4" />}
        trend={{ value: -2.3, label: 'vs last month' }}
        color="blue"
      />
      <MetricCard
        title="Stars"
        value={45678}
        icon={<Star className="h-4 w-4" />}
        format="compact"
        trend={{ value: 8.7, label: 'vs last month' }}
        color="purple"
      />
      <MetricCard
        title="Forks"
        value={12345}
        icon={<GitFork className="h-4 w-4" />}
        format="compact"
        trend={{ value: 0, label: 'no change' }}
        color="orange"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of metric cards in a responsive grid layout',
      },
    },
  },
};

export const LoadingGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Loading state for metric cards grid',
      },
    },
  },
};

export const MixedStates: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total PRs"
        value={3456}
        icon={<GitPullRequest className="h-4 w-4" />}
        trend={{ value: 12.5 }}
        color="green"
      />
      <MetricCardSkeleton />
      <MetricCard
        title="Stars"
        value={45678}
        icon={<Star className="h-4 w-4" />}
        format="compact"
        trend={{ value: 8.7 }}
        color="purple"
      />
      <MetricCardSkeleton />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Mixed loading and loaded states for progressive data loading',
      },
    },
  },
};
