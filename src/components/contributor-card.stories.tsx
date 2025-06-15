import type { Meta, StoryObj } from "@storybook/react";
import { ContributorCard } from "./contributor-card";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { MonthlyContributor, RepoStats } from "@/lib/types";

// Mock data for stories
const mockRepoStats: RepoStats = {
  pullRequests: [
    {
      id: 1,
      number: 123,
      title: "Add new feature",
      state: "closed" as const,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T12:00:00Z",
      merged_at: "2024-01-15T12:00:00Z",
      additions: 100,
      deletions: 20,
      repository_owner: "test-org",
      repository_name: "test-repo",
      user: {
        id: 1,
        login: "johndoe",
        avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
        type: "User",
      },
      html_url: "https://github.com/test-org/test-repo/pull/123",
    },
  ],
  loading: false,
  error: null,
};

const mockContributor: MonthlyContributor = {
  login: "johndoe",
  avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
  activity: {
    pullRequests: 15,
    reviews: 8,
    comments: 25,
    totalScore: 134,
    firstContributionDate: "2024-01-15T10:00:00Z",
  },
  rank: 1,
  isWinner: false,
};

const mockWinnerContributor: MonthlyContributor = {
  ...mockContributor,
  login: "janedoe",
  avatar_url: "https://avatars.githubusercontent.com/u/456?v=4",
  isWinner: true,
  activity: {
    pullRequests: 25,
    reviews: 15,
    comments: 40,
    totalScore: 215,
    firstContributionDate: "2024-01-01T10:00:00Z",
  },
};

const mockLowActivityContributor: MonthlyContributor = {
  ...mockContributor,
  login: "newcomer",
  avatar_url: "https://avatars.githubusercontent.com/u/789?v=4",
  rank: 5,
  activity: {
    pullRequests: 2,
    reviews: 1,
    comments: 3,
    totalScore: 8,
    firstContributionDate: "2024-01-20T10:00:00Z",
  },
};

const meta = {
  title: "Components/ContributorCard",
  component: ContributorCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A card component that displays contributor information including avatar, username, activity metrics, and rank.",
      },
    },
  },
  tags: ["autodocs"],
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
          <div className="w-[350px] p-4">
            <Story />
          </div>
        </TooltipProvider>
      </RepoStatsContext.Provider>
    ),
  ],
  argTypes: {
    showRank: {
      control: "boolean",
      description: "Whether to show the contributor rank badge",
    },
    isWinner: {
      control: "boolean",
      description: "Whether this contributor is marked as a winner",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
} satisfies Meta<typeof ContributorCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    contributor: mockContributor,
    showRank: true,
    isWinner: false,
  },
};

export const Winner: Story = {
  args: {
    contributor: mockWinnerContributor,
    showRank: true,
    isWinner: true,
  },
};

export const WithoutRank: Story = {
  args: {
    contributor: mockContributor,
    showRank: false,
    isWinner: false,
  },
};

export const LowActivity: Story = {
  args: {
    contributor: mockLowActivityContributor,
    showRank: true,
    isWinner: false,
  },
};

export const SecondPlace: Story = {
  args: {
    contributor: {
      ...mockContributor,
      rank: 2,
      activity: {
        pullRequests: 12,
        reviews: 6,
        comments: 18,
        totalScore: 96,
        firstContributionDate: "2024-01-10T10:00:00Z",
      },
    },
    showRank: true,
    isWinner: false,
  },
};

export const ThirdPlace: Story = {
  args: {
    contributor: {
      ...mockContributor,
      rank: 3,
      activity: {
        pullRequests: 8,
        reviews: 4,
        comments: 12,
        totalScore: 68,
        firstContributionDate: "2024-01-12T10:00:00Z",
      },
    },
    showRank: true,
    isWinner: false,
  },
};

export const HighActivity: Story = {
  args: {
    contributor: {
      ...mockContributor,
      login: "poweruser",
      avatar_url: "https://avatars.githubusercontent.com/u/999?v=4",
      rank: 1,
      activity: {
        pullRequests: 45,
        reviews: 30,
        comments: 75,
        totalScore: 360,
        firstContributionDate: "2023-12-01T10:00:00Z",
      },
    },
    showRank: true,
    isWinner: false,
  },
};

export const BotContributor: Story = {
  args: {
    contributor: {
      login: "dependabot[bot]",
      avatar_url: "https://avatars.githubusercontent.com/in/29110?v=4",
      activity: {
        pullRequests: 5,
        reviews: 0,
        comments: 0,
        totalScore: 5,
        firstContributionDate: "2024-01-20T10:00:00Z",
      },
      rank: 10,
      isWinner: false,
    },
    showRank: true,
    isWinner: false,
  },
};
