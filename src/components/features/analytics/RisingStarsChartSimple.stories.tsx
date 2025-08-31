import type { Meta, StoryObj } from '@storybook/react';
import { RisingStarsChartSimple } from './RisingStarsChartSimple';
import type { RisingStarsData } from '@/lib/analytics/rising-stars-data';

const meta = {
  title: 'Features/Analytics/RisingStarsChartSimple',
  component: RisingStarsChartSimple,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RisingStarsChartSimple>;

export default meta;
type Story = StoryObj<typeof meta>;

// Generate mock rising stars data
const generateMockData = (count: number = 30): RisingStarsData[] => {
  const contributors = Array.from({ length: count }, (_, i) => {
    const isNewContributor = Math.random() > 0.7;
    const isRisingStar = Math.random() > 0.8;
    const baseActivity = Math.floor(Math.random() * 20) + 1;

    return {
      x: Math.floor(Math.random() * 50) + 5, // commits
      y: Math.floor(Math.random() * 30) + 2, // PRs + issues
      size: Math.random() * 80 + 20, // velocity score scaled
      contributor: {
        login: `contributor-${i + 1}`,
        avatar_url: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 100000)}`,
        github_id: Math.floor(Math.random() * 100000),
        commits: Math.floor(Math.random() * 50) + 5,
        pullRequests: Math.floor(Math.random() * 20) + 2,
        issues: Math.floor(Math.random() * 10),
        totalActivity: baseActivity,
        velocityScore: Math.random() * 10 + 1,
        growthRate: isRisingStar ? Math.random() * 200 + 50 : Math.random() * 50,
        firstContributionDate: new Date(
          Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
        lastContributionDate: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        contributionSpan: Math.floor(Math.random() * 365) + 1,
        isNewContributor,
        isRisingStar,
      },
    };
  });

  return [
    {
      id: 'rising-stars',
      data: contributors,
    },
  ];
};

export const Default: Story = {
  args: {
    data: generateMockData(),
    height: 500,
    maxBubbles: 50,
  },
};

export const ManyContributors: Story = {
  args: {
    data: generateMockData(50),
    height: 600,
    maxBubbles: 50,
  },
};

export const FewContributors: Story = {
  args: {
    data: generateMockData(10),
    height: 400,
    maxBubbles: 50,
  },
};

export const EmptyState: Story = {
  args: {
    data: [
      {
        id: 'rising-stars',
        data: [],
      },
    ],
    height: 400,
  },
};
