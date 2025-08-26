import type { Meta, StoryObj } from '@storybook/react';
import { ContributorOfTheMonth } from './contributor-of-the-month';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ContributorRanking, RepoStats } from '@/lib/types';

// Mock data for stories
const mockRepoStats: RepoStats = {
  pullRequests: [],
  loading: false,
  error: null,
};

const createMockContributor = (
  login: string,
  rank: number,
  pullRequests: number,
  reviews: number,
  comments: number,
) => ({
  login,
  avatar_url: `https://avatars.githubusercontent.com/u/${rank}?v=4`,
  activity: {
    pullRequests,
    reviews,
    comments,
    totalScore: pullRequests + reviews * 3 + comments * 3,
    firstContributionDate: '2024-01-15T10:00:00Z',
  },
  rank,
  isWinner: rank === 1,
});

const mockLeaderboardRanking: ContributorRanking = {
  month: 'January',
  year: 2024,
  phase: 'running_leaderboard',
  contributors: [
    createMockContributor('janedoe', 1, 25, 15, 40),
    createMockContributor('johndoe', 2, 20, 12, 35),
    createMockContributor('developer3', 3, 18, 10, 30),
    createMockContributor('coder4', 4, 15, 8, 25),
    createMockContributor('contributor5', 5, 12, 6, 20),
  ],
};

const mockWinnerRanking: ContributorRanking = {
  ...mockLeaderboardRanking,
  phase: 'winner_announcement',
  winner: mockLeaderboardRanking.contributors[0],
};

const mockMinimalActivityRanking: ContributorRanking = {
  month: 'February',
  year: 2024,
  phase: 'running_leaderboard',
  contributors: [
    createMockContributor('newcomer1', 1, 2, 1, 3),
    createMockContributor('newcomer2', 2, 1, 0, 2),
  ],
};

const mockEmptyRanking: ContributorRanking = {
  month: 'March',
  year: 2024,
  phase: 'running_leaderboard',
  contributors: [],
};

const meta = {
  title: 'Components/ContributorOfTheMonth',
  component: ContributorOfTheMonth,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A component that showcases the top contributor for the month, with different phases for winner announcement and leaderboard display.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <RepoStatsContext.Provider
        value={{
          stats: mockRepoStats,
          includeBots: false,
          setIncludeBots: () => {},
          lotteryFactor: null,
          directCommitsData: null,
        }}
      >
        <TooltipProvider>
          <div className="w-[500px] p-4">
            <Story />
          </div>
        </TooltipProvider>
      </RepoStatsContext.Provider>
    ),
  ],
  argTypes: {
    loading: {
      control: 'boolean',
      description: 'Whether the component is in loading state',
    },
    error: {
      control: 'text',
      description: 'Error message to display',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof ContributorOfTheMonth>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Leaderboard: Story = {
  args: {
    ranking: mockLeaderboardRanking,
    loading: false,
    error: null,
  },
};

export const WinnerAnnouncement: Story = {
  args: {
    ranking: mockWinnerRanking,
    loading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    ranking: null,
    loading: true,
    error: null,
  },
};

export const Error: Story = {
  args: {
    ranking: null,
    loading: false,
    error: 'Failed to load contributor data. Please try again later.',
  },
};

export const NoActivity: Story = {
  args: {
    ranking: mockEmptyRanking,
    loading: false,
    error: null,
  },
};

export const MinimalActivity: Story = {
  args: {
    ranking: mockMinimalActivityRanking,
    loading: false,
    error: null,
  },
};

export const SingleContributor: Story = {
  args: {
    ranking: {
      month: 'April',
      year: 2024,
      phase: 'running_leaderboard',
      contributors: [createMockContributor('solodev', 1, 10, 5, 15)],
    },
    loading: false,
    error: null,
  },
};

export const HighActivityMonth: Story = {
  args: {
    ranking: {
      month: 'December',
      year: 2024,
      phase: 'running_leaderboard',
      contributors: [
        createMockContributor('poweruser', 1, 50, 30, 80),
        createMockContributor('superdev', 2, 45, 25, 70),
        createMockContributor('megacoder', 3, 40, 22, 65),
        createMockContributor('ultradev', 4, 35, 20, 60),
        createMockContributor('hypercoder', 5, 30, 18, 55),
      ],
    },
    loading: false,
    error: null,
  },
};

export const WinnerWithHighActivity: Story = {
  args: {
    ranking: {
      month: 'December',
      year: 2024,
      phase: 'winner_announcement',
      contributors: [
        createMockContributor('champion', 1, 60, 40, 100),
        createMockContributor('runner-up', 2, 45, 25, 70),
      ],
      winner: createMockContributor('champion', 1, 60, 40, 100),
    },
    loading: false,
    error: null,
  },
};
