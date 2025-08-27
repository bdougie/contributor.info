import type { Meta, StoryObj } from '@storybook/react';
import { BarChart } from './BarChart';

const meta = {
  title: 'Components/Charts/BarChart',
  component: BarChart,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A bar chart component built on uPlot with grouped bars support and theme support.',
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
    grouped: {
      control: 'boolean',
      description: 'Enable grouped bars',
    },
    responsive: {
      control: 'boolean',
      description: 'Enable responsive sizing',
    },
    height: {
      control: 'number',
      description: 'Chart height in pixels',
    },
    barWidth: {
      control: { type: 'range', min: 0.1, max: 1.0, step: 0.1 },
      description: 'Bar width (0.1 to 1.0)',
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
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [
    {
      label: 'Sales',
      data: [1200, 1900, 1600, 2100, 1800, 2400],
      color: '#3b82f6',
    },
    {
      label: 'Profit',
      data: [300, 450, 400, 525, 450, 600],
      color: '#10b981',
    },
    {
      label: 'Expenses',
      data: [900, 1450, 1200, 1575, 1350, 1800],
      color: '#f59e0b',
    },
  ],
};

const repositoryData = {
  labels: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java'],
  datasets: [
    {
      label: 'Repositories',
      data: [45, 32, 28, 15, 12, 8],
      color: '#8b5cf6',
    },
  ],
};

const performanceData = {
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  datasets: [
    {
      label: '2023',
      data: [85, 88, 92, 89],
      color: '#06b6d4',
    },
    {
      label: '2024',
      data: [90, 93, 96, 94],
      color: '#f97316',
    },
  ],
};

export const Default: Story = {
  args: {
    data: sampleData,
    height: 400,
    showGrid: true,
    showLegend: true,
    grouped: true,
    responsive: true,
  },
};

export const SingleSeries: Story = {
  args: {
    data: repositoryData,
    height: 350,
    xAxisLabel: 'Programming Language',
    yAxisLabel: 'Number of Repositories',
    showGrid: true,
    showLegend: true,
    grouped: false,
  },
};

export const DarkTheme: Story = {
  args: {
    data: sampleData,
    height: 400,
    isDark: true,
    showGrid: true,
    showLegend: true,
    grouped: true,
  },
};

export const UngroupedBars: Story = {
  args: {
    data: performanceData,
    height: 350,
    grouped: false,
    xAxisLabel: 'Quarter',
    yAxisLabel: 'Performance Score',
    showGrid: true,
    showLegend: true,
  },
};

export const WideBarWidth: Story = {
  args: {
    data: repositoryData,
    height: 350,
    barWidth: 0.8,
    showGrid: true,
    showLegend: true,
    grouped: false,
  },
};

export const NarrowBarWidth: Story = {
  args: {
    data: sampleData,
    height: 400,
    barWidth: 0.4,
    grouped: true,
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
    grouped: true,
  },
};

export const NoLegend: Story = {
  args: {
    data: sampleData,
    height: 400,
    showGrid: true,
    showLegend: false,
    grouped: true,
  },
};

export const LongLabels: Story = {
  args: {
    data: {
      labels: [
        'Frontend Development',
        'Backend Services',
        'Database Management',
        'Infrastructure',
        'Quality Assurance',
        'Documentation',
      ],
      datasets: [
        {
          label: 'Hours Spent',
          data: [120, 95, 75, 60, 45, 30],
          color: '#ef4444',
        },
      ],
    },
    height: 400,
    xAxisLabel: 'Category',
    yAxisLabel: 'Hours',
    showGrid: true,
    showLegend: true,
    grouped: false,
  },
};

export const WithNullValues: Story = {
  args: {
    data: {
      labels: ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'],
      datasets: [
        {
          label: 'Completed Tasks',
          data: [25, null, 18, 22, null],
          color: '#22c55e',
        },
        {
          label: 'In Progress',
          data: [8, 12, null, 15, 10],
          color: '#f59e0b',
        },
      ],
    },
    height: 350,
    grouped: true,
    showGrid: true,
    showLegend: true,
  },
};
