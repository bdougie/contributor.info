import type { Meta, StoryObj } from '@storybook/react';
import { ActivityChart, ActivityChartSkeleton, type ActivityDataPoint } from './ActivityChart';

// Generate sample activity data
const generateActivityData = (days: number, pattern: 'normal' | 'refactoring' | 'feature' | 'mixed' = 'mixed'): ActivityDataPoint[] => {
  const data: ActivityDataPoint[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    let additions = 0;
    let deletions = 0;
    
    switch (pattern) {
      case 'normal':
        // Balanced additions and deletions
        additions = Math.floor(Math.random() * 300) + 100;
        deletions = Math.floor(Math.random() * 200) + 50;
        break;
        
      case 'refactoring':
        // More deletions than additions
        additions = Math.floor(Math.random() * 100) + 50;
        deletions = Math.floor(Math.random() * 400) + 200;
        break;
        
      case 'feature':
        // More additions than deletions
        additions = Math.floor(Math.random() * 500) + 300;
        deletions = Math.floor(Math.random() * 100) + 20;
        break;
        
      case 'mixed':
        // Varying patterns
        const dayPattern = i % 3;
        if (dayPattern === 0) {
          // Normal day
          additions = Math.floor(Math.random() * 300) + 100;
          deletions = Math.floor(Math.random() * 200) + 50;
        } else if (dayPattern === 1) {
          // Refactoring day
          additions = Math.floor(Math.random() * 100) + 50;
          deletions = Math.floor(Math.random() * 400) + 200;
        } else {
          // Feature day
          additions = Math.floor(Math.random() * 500) + 300;
          deletions = Math.floor(Math.random() * 100) + 20;
        }
        break;
    }
    
    data.push({
      date: date.toISOString(),
      additions,
      deletions,
      commits: Math.floor(Math.random() * 20) + 5,
      files_changed: Math.floor(Math.random() * 30) + 10,
    });
  }
  
  return data;
};

const meta = {
  title: 'Features/Workspace/ActivityChart',
  component: ActivityChart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A candlestick chart showing code activity with additions vs deletions. Green bars indicate days with more additions, red bars show days with more deletions, and gray bars show balanced changes.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'Chart title',
    },
    description: {
      control: 'text',
      description: 'Optional description shown in tooltip',
    },
    height: {
      control: { type: 'range', min: 200, max: 500, step: 50 },
      description: 'Chart height in pixels',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading state',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Code Activity',
    description: 'Daily code changes showing additions vs deletions',
    data: generateActivityData(30, 'mixed'),
    height: 300,
  },
};

export const WeeklyActivity: Story = {
  args: {
    title: 'Last 7 Days',
    description: 'Recent code activity in your workspace',
    data: generateActivityData(7, 'mixed'),
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story: 'A week of mixed development activity',
      },
    },
  },
};

export const RefactoringPeriod: Story = {
  args: {
    title: 'Refactoring Sprint',
    description: 'Heavy code cleanup and optimization',
    data: generateActivityData(14, 'refactoring'),
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows a period focused on code refactoring with more deletions than additions (red bars)',
      },
    },
  },
};

export const FeatureDevelopment: Story = {
  args: {
    title: 'Feature Development',
    description: 'New feature implementation phase',
    data: generateActivityData(14, 'feature'),
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows active feature development with more additions than deletions (green bars)',
      },
    },
  },
};

export const BalancedActivity: Story = {
  args: {
    title: 'Balanced Development',
    description: 'Normal development cycle with balanced changes',
    data: generateActivityData(30, 'normal'),
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows typical development with balanced additions and deletions',
      },
    },
  },
};

export const QuarterlyView: Story = {
  args: {
    title: '90 Day Activity',
    description: 'Long-term code activity patterns',
    data: generateActivityData(90, 'mixed'),
    height: 350,
  },
  parameters: {
    docs: {
      description: {
        story: 'Three months of development activity showing various patterns',
      },
    },
  },
};

export const HighVolume: Story = {
  args: {
    title: 'High Activity Period',
    description: 'Intense development phase',
    data: generateActivityData(30, 'mixed').map(d => ({
      ...d,
      additions: d.additions * 3,
      deletions: d.deletions * 2,
      commits: d.commits * 2,
      files_changed: d.files_changed * 2,
    })),
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows a period of very high development activity',
      },
    },
  },
};

export const LowActivity: Story = {
  args: {
    title: 'Maintenance Mode',
    description: 'Minimal changes and bug fixes',
    data: generateActivityData(30, 'normal').map(d => ({
      ...d,
      additions: Math.floor(d.additions * 0.1),
      deletions: Math.floor(d.deletions * 0.1),
      commits: Math.max(1, Math.floor(d.commits * 0.3)),
      files_changed: Math.max(1, Math.floor(d.files_changed * 0.2)),
    })),
    height: 300,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows a period of low activity, typical during maintenance',
      },
    },
  },
};

export const NoData: Story = {
  args: {
    title: 'Code Activity',
    data: [],
    emptyMessage: 'No activity data available. Start committing code to see activity patterns.',
    height: 300,
  },
};

export const Loading: Story = {
  args: {
    title: 'Code Activity',
    data: [],
    loading: true,
    height: 300,
  },
};

export const LoadingSkeleton: Story = {
  render: () => <ActivityChartSkeleton height={300} />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton for activity chart',
      },
    },
  },
};

export const ComparisonDemo: Story = {
  render: () => (
    <div className="space-y-4">
      <ActivityChart
        title="Feature Sprint"
        description="Heavy feature development"
        data={generateActivityData(14, 'feature')}
        height={250}
      />
      <ActivityChart
        title="Refactoring Week"
        description="Code cleanup and optimization"
        data={generateActivityData(14, 'refactoring')}
        height={250}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of different development phases',
      },
    },
  },
};

export const Mobile: Story = {
  args: {
    title: 'Code Activity',
    data: generateActivityData(7, 'mixed'),
    height: 250,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Activity chart on mobile viewport',
      },
    },
  },
};