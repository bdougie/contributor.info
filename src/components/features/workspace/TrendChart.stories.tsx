import type { Meta, StoryObj } from '@storybook/react';
import { TrendChart, TrendChartSkeleton } from './TrendChart';

// Generate sample data for the last 30 days
const generateSampleData = (days: number) => {
  const labels = [];
  const prs = [];
  const issues = [];
  const commits = [];

  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    // Generate realistic looking data with some variance
    prs.push(Math.floor(Math.random() * 20) + 10);
    issues.push(Math.floor(Math.random() * 15) + 5);
    commits.push(Math.floor(Math.random() * 50) + 20);
  }

  return {
    labels,
    datasets: [
      {
        label: 'Pull Requests',
        data: prs,
        color: '#10b981', // green
      },
      {
        label: 'Issues',
        data: issues,
        color: '#f97316', // orange
      },
      {
        label: 'Commits',
        data: commits,
        color: '#8b5cf6', // purple
      },
    ],
  };
};

const meta = {
  title: 'Features/Workspace/TrendChart',
  component: TrendChart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A trend chart component for displaying workspace activity over time using line charts.',
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
    showLegend: {
      control: 'boolean',
      description: 'Show chart legend',
    },
    showGrid: {
      control: 'boolean',
      description: 'Show grid lines',
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
} satisfies Meta<typeof TrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Activity Trends',
    description: 'Repository activity over the last 30 days',
    data: generateSampleData(30),
    showLegend: true,
    showGrid: true,
    height: 300,
  },
};

export const SingleDataset: Story = {
  args: {
    title: 'Pull Request Activity',
    data: {
      labels: generateSampleData(30).labels,
      datasets: [
        {
          label: 'Pull Requests',
          data: generateSampleData(30).datasets[0].data,
          color: '#10b981',
        },
      ],
    },
    yAxisLabel: 'Number of PRs',
    showLegend: false,
    height: 250,
  },
};

export const WeeklyView: Story = {
  args: {
    title: 'Last 7 Days',
    description: 'Recent activity in your workspace',
    data: generateSampleData(7),
    showLegend: true,
    showGrid: true,
    height: 300,
  },
};

export const QuarterlyView: Story = {
  args: {
    title: '90 Day Trends',
    description: 'Long-term activity patterns',
    data: generateSampleData(90),
    showLegend: true,
    showGrid: true,
    height: 350,
  },
};

export const NoData: Story = {
  args: {
    title: 'Activity Trends',
    data: {
      labels: [],
      datasets: [],
    },
    emptyMessage: 'No activity data available. Start by adding repositories to your workspace.',
    height: 300,
  },
};

export const Loading: Story = {
  args: {
    title: 'Activity Trends',
    data: { labels: [], datasets: [] },
    loading: true,
    height: 300,
  },
};

export const ComparisonChart: Story = {
  args: {
    title: 'Team Performance Comparison',
    description: 'Comparing activity across different metrics',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [
        {
          label: 'Team A',
          data: [65, 78, 82, 91],
          color: '#3b82f6',
        },
        {
          label: 'Team B',
          data: [45, 52, 68, 74],
          color: '#10b981',
        },
        {
          label: 'Team C',
          data: [38, 44, 51, 63],
          color: '#f97316',
        },
      ],
    },
    yAxisLabel: 'Productivity Score',
    height: 300,
  },
};

export const MultipleCharts: Story = {
  render: () => (
    <div className="space-y-4">
      <TrendChart
        title="Pull Request Activity"
        data={{
          labels: generateSampleData(30).labels,
          datasets: [generateSampleData(30).datasets[0]],
        }}
        height={250}
        showLegend={false}
      />
      <TrendChart
        title="Issue Resolution"
        data={{
          labels: generateSampleData(30).labels,
          datasets: [generateSampleData(30).datasets[1]],
        }}
        height={250}
        showLegend={false}
      />
      <TrendChart
        title="Commit Frequency"
        data={{
          labels: generateSampleData(30).labels,
          datasets: [generateSampleData(30).datasets[2]],
        }}
        height={250}
        showLegend={false}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Multiple charts showing different metrics separately',
      },
    },
  },
};

export const LoadingSkeleton: Story = {
  render: () => <TrendChartSkeleton height={300} />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton for trend chart',
      },
    },
  },
};
