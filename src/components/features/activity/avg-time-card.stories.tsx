import type { Meta, StoryObj } from '@storybook/react';
import { AvgTimeCard } from './avg-time-card';

const meta = {
  title: 'Features/Activity/AvgTimeCard',
  component: AvgTimeCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A card component that displays the average time it takes to merge pull requests, with trend indicators and color-coded values based on merge time thresholds.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[200px] p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    averageMergeTime: {
      control: 'number',
      description: 'Average merge time in hours',
    },
    averageMergeTimeTrend: {
      control: 'select',
      options: ['up', 'down', 'stable'],
      description: 'Trend direction for merge time',
    },
    loading: {
      control: 'boolean',
      description: 'Whether the card is in a loading state',
    },
  },
} satisfies Meta<typeof AvgTimeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    averageMergeTime: 36,
    averageMergeTimeTrend: 'down',
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    averageMergeTime: 0,
    averageMergeTimeTrend: 'stable',
    loading: true,
  },
};

export const FastMergeTime: Story = {
  args: {
    averageMergeTime: 6,
    averageMergeTimeTrend: 'down',
    loading: false,
  },
};

export const ModerateTime: Story = {
  args: {
    averageMergeTime: 48,
    averageMergeTimeTrend: 'stable',
    loading: false,
  },
};

export const SlowMergeTime: Story = {
  args: {
    averageMergeTime: 168,
    averageMergeTimeTrend: 'up',
    loading: false,
  },
};

export const TrendingUp: Story = {
  args: {
    averageMergeTime: 72,
    averageMergeTimeTrend: 'up',
    loading: false,
  },
};

export const TrendingDown: Story = {
  args: {
    averageMergeTime: 24,
    averageMergeTimeTrend: 'down',
    loading: false,
  },
};

export const VeryFast: Story = {
  args: {
    averageMergeTime: 2,
    averageMergeTimeTrend: 'down',
    loading: false,
  },
};

export const VerySlow: Story = {
  args: {
    averageMergeTime: 336,
    averageMergeTimeTrend: 'up',
    loading: false,
  },
};
