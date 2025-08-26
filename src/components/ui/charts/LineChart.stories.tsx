import type { Meta, StoryObj } from '@storybook/react';
import { LineChart } from './LineChart';

const meta = {
  title: 'Components/Charts/LineChart',
  component: LineChart,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A line chart component built on uPlot with theme support and Recharts-like API.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isDark: {
      control: 'boolean',
      description: 'Enable dark theme',
    },
    showGrid: {
      control: 'boolean',
      description: 'Show grid lines',
    },
    showLegend: {
      control: 'boolean',
      description: 'Show legend',
    },
    responsive: {
      control: 'boolean',
      description: 'Enable responsive sizing',
    },
    height: {
      control: 'number',
      description: 'Chart height in pixels',
    },
    xAxisLabel: {
      control: 'text',
      description: 'X-axis label',
    },
    yAxisLabel: {
      control: 'text',
      description: 'Y-axis label',
    },
  },
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'Active Contributors',
      data: [65, 78, 85, 71, 56, 89, 95, 82, 73, 69, 88, 92],
      color: '#3b82f6',
    },
    {
      label: 'New Contributors',
      data: [28, 48, 40, 35, 27, 45, 52, 38, 33, 29, 41, 47],
      color: '#10b981',
    },
  ],
};

const performanceData = {
  labels: Array.from({ length: 50 }, (_, i) => i),
  datasets: [
    {
      label: 'Response Time (ms)',
      data: Array.from(
        { length: 50 },
        () => Math.floor(Math.random() * 100) + 50 + Math.sin(Math.random() * 10) * 20,
      ),
      color: '#8b5cf6',
    },
  ],
};

export const Default: Story = {
  args: {
    data: sampleData,
    height: 400,
    showGrid: true,
    showLegend: true,
    responsive: true,
  },
};

export const DarkTheme: Story = {
  args: {
    data: sampleData,
    height: 400,
    isDark: true,
    showGrid: true,
    showLegend: true,
  },
};

export const WithAxisLabels: Story = {
  args: {
    data: sampleData,
    height: 400,
    xAxisLabel: 'Month',
    yAxisLabel: 'Contributors',
    showGrid: true,
    showLegend: true,
  },
};

export const SingleSeries: Story = {
  args: {
    data: {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [
        {
          label: 'Revenue',
          data: [1200, 1800, 1600, 2200],
          color: '#f59e0b',
        },
      ],
    },
    height: 300,
    showGrid: true,
    showLegend: true,
  },
};

export const NoGrid: Story = {
  args: {
    data: sampleData,
    height: 400,
    showGrid: false,
    showLegend: true,
  },
};

export const NoLegend: Story = {
  args: {
    data: sampleData,
    height: 400,
    showGrid: true,
    showLegend: false,
  },
};

export const WithPoints: Story = {
  args: {
    data: {
      ...sampleData,
      datasets: sampleData.datasets.map((dataset) => ({
        ...dataset,
        points: true,
      })),
    },
    height: 400,
    showGrid: true,
    showLegend: true,
  },
};

export const Performance: Story = {
  args: {
    data: performanceData,
    height: 300,
    xAxisLabel: 'Time',
    yAxisLabel: 'Response Time (ms)',
    showGrid: true,
    showLegend: true,
  },
};

export const WithNullValues: Story = {
  args: {
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
      datasets: [
        {
          label: 'Commits',
          data: [45, null, 38, 42, null, 51],
          color: '#ef4444',
        },
        {
          label: 'PRs',
          data: [12, 15, null, 18, 16, 14],
          color: '#06b6d4',
        },
      ],
    },
    height: 350,
    showGrid: true,
    showLegend: true,
  },
};
