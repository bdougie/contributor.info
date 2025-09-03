import type { Meta, StoryObj } from '@storybook/react';
import { IssueMetricsAndTrendsCard } from './issue-metrics-and-trends-card';

const meta: Meta<typeof IssueMetricsAndTrendsCard> = {
  title: 'Features/Activity/IssueMetricsAndTrendsCard',
  component: IssueMetricsAndTrendsCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Displays comprehensive issue metrics and trends for a repository, including issue health metrics, activity patterns, and trend analysis.',
      },
    },
  },
  argTypes: {
    owner: {
      description: 'Repository owner/organization name',
      control: 'text',
    },
    repo: {
      description: 'Repository name',
      control: 'text',
    },
    timeRange: {
      description: 'Time range for metrics calculation in days',
      control: 'select',
      options: ['7', '30', '90', '180'],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
    timeRange: '30',
  },
};

export const SevenDayRange: Story = {
  args: {
    owner: 'vercel',
    repo: 'next.js',
    timeRange: '7',
  },
};

export const NinetyDayRange: Story = {
  args: {
    owner: 'microsoft',
    repo: 'vscode',
    timeRange: '90',
  },
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state while issue metrics are being calculated.',
      },
    },
  },
  render: () => {
    // Mock the loading state by using a non-existent repo
    return <IssueMetricsAndTrendsCard owner="loading" repo="example" timeRange="30" />;
  },
};
