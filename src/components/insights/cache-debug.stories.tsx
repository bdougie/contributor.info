import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';

// Create a simple mock cache debug component for Storybook
const MockCacheDebug = ({
  variant = 'high-performance',
}: {
  variant?: 'high-performance' | 'low-performance' | 'empty' | 'production';
}) => {
  // Only show in development (simulated)
  if (variant === 'production') {
    return null;
  }

  const cacheData = {
    'high-performance': {
      totalEntries: 45,
      totalHits: 128,
      totalMisses: 22,
      hitRate: 85.3,
      totalSize: '2.0 MB',
      entriesByType: { health: 15, recommendation: 18, pattern: 12 },
    },
    'low-performance': {
      totalEntries: 8,
      totalHits: 12,
      totalMisses: 35,
      hitRate: 25.5,
      totalSize: '512 KB',
      entriesByType: { health: 2, recommendation: 3, pattern: 3 },
    },
    empty: {
      totalEntries: 0,
      totalHits: 0,
      totalMisses: 5,
      hitRate: 0,
      totalSize: '0 B',
      entriesByType: { health: 0, recommendation: 0, pattern: 0 },
    },
  };

  const _ = cacheData[variant as keyof typeof cacheData];
  const hitRateColor =
    data.hitRate >= 80 ? 'text-green-600' : data.hitRate >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="p-4 border rounded-lg bg-card w-fit">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
        <h3 className="font-semibold text-sm">Cache Debug</h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">DEV</span>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-lg font-bold">{data.totalEntries}</div>
          <div className="text-xs text-muted-foreground">Entries</div>
        </div>
        <div>
          <div className={`text-lg font-bold ${hitRateColor}`}>{data.hitRate}%</div>
          <div className="text-xs text-muted-foreground">Hit Rate</div>
        </div>
        <div>
          <div className="text-sm font-medium">{data.totalHits}</div>
          <div className="text-xs text-muted-foreground">Hits</div>
        </div>
        <div>
          <div className="text-sm font-medium">{data.totalMisses}</div>
          <div className="text-xs text-muted-foreground">Misses</div>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-1">Memory: {data.totalSize}</div>
        <div className="w-full bg-muted rounded-full h-1">
          <div
            className="h-1 rounded-full bg-blue-500"
            style={{ width: `${Math.min(100, (_data.totalEntries / 50) * 100)}%` }}
          />
        </div>
      </div>

      {/* Breakdown by Type */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium">Entries by Type</div>
        {Object.entries(_data.entriesByType).map(([type, count]) => (
          <div key={type} className="flex justify-between text-xs">
            <span className="capitalize">{type}:</span>
            <span>{count}</span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">
          Cleanup
        </button>
        <button className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">
          Clear All
        </button>
      </div>
    </div>
  );
};

const meta: Meta<typeof MockCacheDebug> = {
  title: 'Components/Insights/CacheDebug',
  component: MockCacheDebug,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Development-only debug component for monitoring LLM cache performance, hit rates, and memory usage. Provides tools for cache management and performance optimization during development.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['high-performance', 'low-performance', 'empty', 'production'],
      description: 'Cache performance state',
    },
  },
  args: {
    variant: 'high-performance',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// High performance cache state
export const HighPerformance: Story = {};

// Low performance cache state
export const LowPerformance: Story = {
  args: {
    variant: 'low-performance',
  },
};

// Empty cache state
export const EmptyCache: Story = {
  args: {
    variant: 'empty',
  },
};

// Production mode (should not render)
export const ProductionMode: Story = {
  args: {
    variant: 'production',
  },
};

// Interactive cache management
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify cache debug component is displayed
    await expect(canvas.getByText('Cache Debug')).toBeInTheDocument();

    // Check hit rate is displayed
    await expect(canvas.getByText('85.3%')).toBeInTheDocument();

    // Check total entries count
    await expect(canvas.getByText('45')).toBeInTheDocument();

    // Test action buttons
    const cleanupButton = canvas.getByText('Cleanup');
    await expect(cleanupButton).toBeInTheDocument();

    const clearButton = canvas.getByText('Clear All');
    await expect(clearButton).toBeInTheDocument();
  },
};

// Cache performance comparison
export const PerformanceComparison: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3 text-green-600">High Performance Cache</h3>
        <MockCacheDebug variant="high-performance" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3 text-red-600">Low Performance Cache</h3>
        <MockCacheDebug variant="low-performance" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-600">Empty Cache</h3>
        <MockCacheDebug variant="empty" />
      </div>
    </div>
  ),
};

// Different cache states side by side
export const CacheStatesComparison: Story = {
  render: () => (
    <div className="flex gap-6 flex-wrap">
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Optimized</h4>
        <MockCacheDebug variant="high-performance" />
      </div>
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Needs Attention</h4>
        <MockCacheDebug variant="low-performance" />
      </div>
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Starting Fresh</h4>
        <MockCacheDebug variant="empty" />
      </div>
    </div>
  ),
};
