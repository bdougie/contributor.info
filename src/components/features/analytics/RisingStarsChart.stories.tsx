import type { Meta, StoryObj } from '@storybook/react';
import { RisingStarsChart } from './RisingStarsChart';
import type { RisingStarsData } from '@/lib/analytics/rising-stars-data';

const meta = {
  title: 'Features/Analytics/RisingStarsChart',
  component: RisingStarsChart,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RisingStarsChart>;

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
    data: generateMockData(100),
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

export const HighActivity: Story = {
  args: {
    data: [
      {
        id: 'rising-stars',
        data: Array.from({ length: 20 }, (_, i) => ({
          x: Math.floor(Math.random() * 30) + 50, // higher commits
          y: Math.floor(Math.random() * 20) + 30, // higher PRs
          size: Math.random() * 50 + 50, // larger bubbles
          contributor: {
            login: `power-user-${i + 1}`,
            avatar_url: `https://avatars.githubusercontent.com/u/${i + 1000}`,
            github_id: i + 1000,
            commits: Math.floor(Math.random() * 30) + 50,
            pullRequests: Math.floor(Math.random() * 15) + 20,
            issues: Math.floor(Math.random() * 10) + 10,
            totalActivity: Math.floor(Math.random() * 50) + 80,
            velocityScore: Math.random() * 5 + 15,
            growthRate: Math.random() * 300 + 100,
            firstContributionDate: new Date(
              Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000
            ).toISOString(),
            lastContributionDate: new Date().toISOString(),
            contributionSpan: Math.floor(Math.random() * 180) + 1,
            isNewContributor: false,
            isRisingStar: true,
          },
        })),
      },
    ],
    height: 500,
  },
};

export const NewContributorsWave: Story = {
  args: {
    data: [
      {
        id: 'rising-stars',
        data: Array.from({ length: 25 }, (_, i) => {
          const isNew = i < 15;
          return {
            x: Math.floor(Math.random() * 20) + (isNew ? 5 : 15),
            y: Math.floor(Math.random() * 15) + (isNew ? 3 : 10),
            size: Math.random() * 60 + 30,
            contributor: {
              login: `${isNew ? 'new' : 'active'}-contributor-${i + 1}`,
              avatar_url: `https://avatars.githubusercontent.com/u/${i + 5000}`,
              github_id: i + 5000,
              commits: Math.floor(Math.random() * 20) + (isNew ? 5 : 15),
              pullRequests: Math.floor(Math.random() * 10) + (isNew ? 2 : 8),
              issues: Math.floor(Math.random() * 5) + (isNew ? 1 : 3),
              totalActivity: Math.floor(Math.random() * 30) + (isNew ? 8 : 25),
              velocityScore: Math.random() * 8 + (isNew ? 2 : 5),
              growthRate: isNew ? Math.random() * 500 + 200 : Math.random() * 100,
              firstContributionDate: new Date(
                Date.now() - (isNew ? 30 : 200) * 24 * 60 * 60 * 1000
              ).toISOString(),
              lastContributionDate: new Date().toISOString(),
              contributionSpan: isNew ? 30 : 200,
              isNewContributor: isNew,
              isRisingStar: isNew && i < 5,
            },
          };
        }),
      },
    ],
    height: 500,
  },
};

export const CompactView: Story = {
  args: {
    data: generateMockData(15),
    height: 350,
    maxBubbles: 15,
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
