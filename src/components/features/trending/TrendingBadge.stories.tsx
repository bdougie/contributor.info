import type { Meta, StoryObj } from '@storybook/react';
import { TrendingBadge } from './TrendingBadge';

const meta = {
  title: 'Features/Trending/TrendingBadge',
  component: TrendingBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A compact badge component for indicating trending status with customizable variants and sizes. Can be used throughout the application to highlight trending repositories.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    score: {
      control: { type: 'number', min: 0, max: 1000 },
    },
    variant: {
      control: 'select',
      options: ['default', 'hot', 'subtle'],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
    showIcon: {
      control: 'boolean',
    },
    showScore: {
      control: 'boolean',
    },
    className: {
      control: 'text',
    },
  },
} satisfies Meta<typeof TrendingBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    score: 85.5,
    variant: 'default',
    size: 'default',
    showIcon: true,
    showScore: true,
  },
};

export const Hot: Story = {
  args: {
    score: 156.8,
    variant: 'hot',
    size: 'default',
    showIcon: true,
    showScore: true,
  },
};

export const Subtle: Story = {
  args: {
    score: 42.3,
    variant: 'subtle',
    size: 'default',
    showIcon: true,
    showScore: true,
  },
};

export const Small: Story = {
  args: {
    score: 75.2,
    variant: 'default',
    size: 'sm',
    showIcon: true,
    showScore: true,
  },
};

export const Large: Story = {
  args: {
    score: 125.7,
    variant: 'default',
    size: 'lg',
    showIcon: true,
    showScore: true,
  },
};

export const NoIcon: Story = {
  args: {
    score: 68.9,
    variant: 'default',
    size: 'default',
    showIcon: false,
    showScore: true,
  },
};

export const NoScore: Story = {
  args: {
    score: 95.4,
    variant: 'default',
    size: 'default',
    showIcon: true,
    showScore: false,
  },
};

export const TextOnly: Story = {
  args: {
    score: 112.3,
    variant: 'default',
    size: 'default',
    showIcon: false,
    showScore: false,
  },
};

export const HighScore: Story = {
  args: {
    score: 1250,
    variant: 'hot',
    size: 'default',
    showIcon: true,
    showScore: true,
  },
};

export const LowScore: Story = {
  args: {
    score: 12.8,
    variant: 'subtle',
    size: 'default',
    showIcon: true,
    showScore: true,
  },
};

export const AutoHot: Story = {
  args: {
    score: 150, // Should automatically use 'hot' variant when score > 100
    variant: 'default',
    size: 'default',
    showIcon: true,
    showScore: true,
  },
};

// Size comparison
export const SizeComparison: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <TrendingBadge score={85.5} size="sm" />
      <TrendingBadge score={85.5} size="default" />
      <TrendingBadge score={85.5} size="lg" />
    </div>
  ),
};

// Variant comparison
export const VariantComparison: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <TrendingBadge score={85.5} variant="subtle" />
      <TrendingBadge score={85.5} variant="default" />
      <TrendingBadge score={156.8} variant="hot" />
    </div>
  ),
};

// Usage examples
export const InCard: Story = {
  render: () => (
    <div className="max-w-sm p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Repository Name</h3>
        <TrendingBadge score={125.7} variant="hot" size="sm" />
      </div>
      <p className="text-sm text-muted-foreground">
        A trending repository with high activity
      </p>
    </div>
  ),
};

export const InList: Story = {
  render: () => (
    <div className="space-y-2">
      {[
        { name: 'continuedev/continue', score: 156.8 },
        { name: 'microsoft/typescript', score: 134.2 },
        { name: 'vercel/ai', score: 98.7 },
        { name: 'vitejs/vite', score: 45.3 },
      ].map((repo, index) => (
        <div key={index} className="flex items-center justify-between p-3 border rounded">
          <span className="font-medium">{repo.name}</span>
          <TrendingBadge 
            score={repo.score} 
            variant={repo.score > 100 ? 'hot' : 'default'} 
            size="sm" 
          />
        </div>
      ))}
    </div>
  ),
};