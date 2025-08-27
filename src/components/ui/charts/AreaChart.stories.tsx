import type { Meta, StoryObj } from '@storybook/react';
import { AreaChart } from './AreaChart';

const meta = {
  title: 'Components/Charts/AreaChart',
  component: AreaChart,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'An area chart component built on uPlot with stacking support and theme support.',
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
    stacked: {
      control: 'boolean',
      description: 'Enable stacked areas',
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
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'Frontend',
      data: [120, 145, 160, 135, 110, 175, 190, 165, 140, 130, 170, 185],
      color: '#3b82f6',
      fillOpacity: 0.4,
    },
    {
      label: 'Backend',
      data: [80, 95, 85, 100, 75, 120, 110, 95, 85, 90, 115, 125],
      color: '#10b981',
      fillOpacity: 0.4,
    },
    {
      label: 'DevOps',
      data: [30, 35, 40, 35, 25, 45, 50, 40, 35, 30, 45, 55],
      color: '#f59e0b',
      fillOpacity: 0.4,
    },
  ],
};

const businessMetricsData = {
  labels: ['Q1 2023', 'Q2 2023', 'Q3 2023', 'Q4 2023', 'Q1 2024', 'Q2 2024'],
  datasets: [
    {
      label: 'Revenue',
      data: [250000, 280000, 320000, 380000, 420000, 450000],
      color: '#8b5cf6',
      fillOpacity: 0.3,
    },
    {
      label: 'Costs',
      data: [150000, 160000, 170000, 180000, 190000, 195000],
      color: '#ef4444',
      fillOpacity: 0.3,
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

export const Stacked: Story = {
  args: {
    data: sampleData,
    height: 400,
    stacked: true,
    showGrid: true,
    showLegend: true,
    xAxisLabel: 'Month',
    yAxisLabel: 'Contributions',
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

export const DarkThemeStacked: Story = {
  args: {
    data: sampleData,
    height: 400,
    isDark: true,
    stacked: true,
    showGrid: true,
    showLegend: true,
  },
};

export const BusinessMetrics: Story = {
  args: {
    data: businessMetricsData,
    height: 350,
    xAxisLabel: 'Quarter',
    yAxisLabel: 'Amount ($)',
    showGrid: true,
    showLegend: true,
  },
};

export const SingleSeries: Story = {
  args: {
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
      datasets: [
        {
          label: 'Active Users',
          data: [1200, 1350, 1180, 1420, 1380, 1500],
          color: '#06b6d4',
          fillOpacity: 0.5,
        },
      ],
    },
    height: 300,
    showGrid: true,
    showLegend: true,
  },
};

export const CustomOpacity: Story = {
  args: {
    data: {
      ...sampleData,
      datasets: sampleData.datasets.map((dataset, index) => ({
        ...dataset,
        fillOpacity: [0.2, 0.5, 0.8][index],
      })),
    },
    height: 400,
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

export const WithNullValues: Story = {
  args: {
    data: {
      labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
      datasets: [
        {
          label: 'Sales',
          data: [500, 650, null, 720, 680, null, 820],
          color: '#22c55e',
          fillOpacity: 0.4,
        },
        {
          label: 'Leads',
          data: [120, null, 140, 160, null, 180, 200],
          color: '#a78bfa',
          fillOpacity: 0.4,
        },
      ],
    },
    height: 350,
    showGrid: true,
    showLegend: true,
  },
};
