import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { vi } from "vitest";
import { RepoStatsSummary } from "./repo-stats-summary";

// Mock the hooks
const mockUseRepoStats = fn();
const mockUseTimeFormatter = fn(() => ({
  formatRelativeTime: fn((date: string) => {
      const now = new Date();
      const past = new Date(date);
      const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
      if (diffInHours < 24) return `${diffInHours} hours ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    })
}));

vi.mock("@/hooks/use-repo-stats", () => ({
  useRepoStats: mockUseRepoStats
}));

vi.mock("@/hooks/use-time-formatter", () => ({
  useTimeFormatter: mockUseTimeFormatter
}));

// Mock data
const mockPullRequests = [
  {
    id: 1,
    number: 123,
    title: "Add user authentication system",
    state: "closed" as const,
    created_at: "2024-01-10T10:30:00Z",
    updated_at: "2024-01-10T14:00:00Z",
    merged_at: "2024-01-10T14:00:00Z",
    additions: 250,
    deletions: 50,
    repository_owner: "facebook",
    repository_name: "react",
    user: {
      id: 1,
      login: "alice-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      type: "User" as const,
    },
    html_url: "https://github.com/facebook/react/pull/123",
    reviews: [],
    comments: [],
  },
  {
    id: 2,
    number: 124,
    title: "Fix navigation bug on mobile devices",
    state: "open" as const,
    created_at: "2024-01-12T09:15:00Z",
    updated_at: "2024-01-12T09:15:00Z",
    merged_at: null,
    additions: 45,
    deletions: 12,
    repository_owner: "facebook",
    repository_name: "react",
    user: {
      id: 2,
      login: "bob-contributor",
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
      type: "User" as const,
    },
    html_url: "https://github.com/facebook/react/pull/124",
    reviews: [],
    comments: [],
  },
  {
    id: 3,
    number: 125,
    title: "Update documentation for new API endpoints",
    state: "closed" as const,
    created_at: "2024-01-15T16:45:00Z",
    updated_at: "2024-01-15T18:30:00Z",
    merged_at: "2024-01-15T18:30:00Z",
    additions: 120,
    deletions: 30,
    repository_owner: "facebook",
    repository_name: "react",
    user: {
      id: 3,
      login: "carol-docs",
      avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
      type: "User" as const,
    },
    html_url: "https://github.com/facebook/react/pull/125",
    reviews: [],
    comments: [],
  },
];

const meta = {
  title: "Features/Repository/RepoStatsSummary",
  component: RepoStatsSummary,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A comprehensive summary component displaying key repository statistics including pull request metrics, contributor information, lottery factor, and recent activity."
      }
    }
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RepoStatsSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    mockUseRepoStats.mockReturnValue({
      stats: {
        pullRequests: mockPullRequests,
        loading: false,
        error: null
      },
      lotteryFactor: {
        score: 2.3,
        rating: "Good",
        description: "Repository has healthy contributor distribution"
      },
      directCommitsData: null,
      getContributorStats: fn(() => ({
        totalContributors: 3,
        topContributors: [
          { login: "alice-dev", contributions: 15 },
          { login: "bob-contributor", contributions: 8 },
          { login: "carol-docs", contributions: 5 }
        ]
      })),
      getFilteredPullRequests: fn(() => mockPullRequests)
    });

    return (
      <div className="w-[600px] p-4">
        <RepoStatsSummary />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Default repository statistics summary with healthy metrics."
      }
    }
  }
};

export const HighActivityRepository: Story = {
  render: () => {
    const highActivityPRs = Array.from({ length: 50 }, (_, i) => ({
      ...mockPullRequests[0],
      id: i + 1,
      number: i + 100,
      title: `Feature/bug fix #${i + 100}`,
      user: {
        ...mockPullRequests[0].user,
        login: `contributor-${i % 10}`,
        id: i % 10
      }
    }));

    mockUseRepoStats.mockReturnValue({
      stats: {
        pullRequests: highActivityPRs,
        loading: false,
        error: null
      },
      lotteryFactor: {
        score: 4.8,
        rating: "Excellent",
        description: "Very healthy contributor distribution with low bus factor"
      },
      directCommitsData: null,
      getContributorStats: fn(() => ({
        totalContributors: 10,
        topContributors: [
          { login: "contributor-0", contributions: 25 },
          { login: "contributor-1", contributions: 18 },
          { login: "contributor-2", contributions: 12 }
        ]
      })),
      getFilteredPullRequests: fn(() => highActivityPRs)
    });

    return (
      <div className="w-[600px] p-4">
        <RepoStatsSummary />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Repository with high activity showing many contributors and PRs."
      }
    }
  }
};

export const WithDirectCommitsWarning: Story = {
  render: () => {
    mockUseRepoStats.mockReturnValue({
      stats: {
        pullRequests: mockPullRequests,
        loading: false,
        error: null
      },
      lotteryFactor: {
        score: 1.8,
        rating: "Poor",
        description: "High bus factor - few contributors handle most changes"
      },
      directCommitsData: {
        hasYoloCoders: true,
        yoloCoderStats: [
          { login: "admin-user", directCommits: 15 },
          { login: "senior-dev", directCommits: 8 }
        ]
      },
      getContributorStats: fn(() => ({
        totalContributors: 2,
        topContributors: [
          { login: "admin-user", contributions: 20 },
          { login: "senior-dev", contributions: 3 }
        ]
      })),
      getFilteredPullRequests: fn(() => mockPullRequests)
    });

    return (
      <div className="w-[600px] p-4">
        <RepoStatsSummary />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Repository with direct commits warning showing poor review practices."
      }
    }
  }
};

export const LoadingState: Story = {
  render: () => {
    mockUseRepoStats.mockReturnValue({
      stats: {
        pullRequests: [],
        loading: true,
        error: null
      },
      lotteryFactor: null,
      directCommitsData: null,
      getContributorStats: fn(() => ({
        totalContributors: 0,
        topContributors: []
      })),
      getFilteredPullRequests: fn(() => [])
    });

    return (
      <div className="w-[600px] p-4">
        <RepoStatsSummary />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Repository statistics summary in loading state."
      }
    }
  }
};

export const ErrorState: Story = {
  render: () => {
    mockUseRepoStats.mockReturnValue({
      stats: {
        pullRequests: [],
        loading: false,
        error: "Failed to fetch repository data. API rate limit exceeded."
      },
      lotteryFactor: null,
      directCommitsData: null,
      getContributorStats: fn(() => ({
        totalContributors: 0,
        topContributors: []
      })),
      getFilteredPullRequests: fn(() => [])
    });

    return (
      <div className="w-[600px] p-4">
        <RepoStatsSummary />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Repository statistics summary showing error state."
      }
    }
  }
};

export const EmptyRepository: Story = {
  render: () => {
    mockUseRepoStats.mockReturnValue({
      stats: {
        pullRequests: [],
        loading: false,
        error: null
      },
      lotteryFactor: null,
      directCommitsData: null,
      getContributorStats: fn(() => ({
        totalContributors: 0,
        topContributors: []
      })),
      getFilteredPullRequests: fn(() => [])
    });

    return (
      <div className="w-[600px] p-4">
        <RepoStatsSummary />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Repository statistics summary for repository with no activity."
      }
    }
  }
};

export const LowMergeRate: Story = {
  render: () => {
    const lowMergeRatePRs = [
      { ...mockPullRequests[0], merged_at: "2024-01-10T14:00:00Z" }, // merged
      { ...mockPullRequests[1], state: "closed" as const, merged_at: null }, // closed without merge
      { ...mockPullRequests[2], state: "open" as const, merged_at: null }, // still open
      { 
        ...mockPullRequests[0], 
        id: 4, 
        number: 126, 
        state: "closed" as const, 
        merged_at: null 
      }, // closed without merge
    ];

    mockUseRepoStats.mockReturnValue({
      stats: {
        pullRequests: lowMergeRatePRs,
        loading: false,
        error: null
      },
      lotteryFactor: {
        score: 2.1,
        rating: "Fair",
        description: "Moderate contributor distribution"
      },
      directCommitsData: null,
      getContributorStats: fn(() => ({
        totalContributors: 4,
        topContributors: [
          { login: "alice-dev", contributions: 8 },
          { login: "bob-contributor", contributions: 6 },
          { login: "carol-docs", contributions: 4 }
        ]
      })),
      getFilteredPullRequests: fn(() => lowMergeRatePRs)
    });

    return (
      <div className="w-[600px] p-4">
        <RepoStatsSummary />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Repository with low merge rate showing potential review bottlenecks."
      }
    }
  }
};

export const MobileView: Story = {
  render: () => {
    mockUseRepoStats.mockReturnValue({
      stats: {
        pullRequests: mockPullRequests,
        loading: false,
        error: null
      },
      lotteryFactor: {
        score: 3.2,
        rating: "Good",
        description: "Healthy contributor distribution"
      },
      directCommitsData: null,
      getContributorStats: fn(() => ({
        totalContributors: 3,
        topContributors: [
          { login: "alice-dev", contributions: 15 },
          { login: "bob-contributor", contributions: 8 }
        ]
      })),
      getFilteredPullRequests: fn(() => mockPullRequests)
    });

    return (
      <div className="w-full p-4">
        <RepoStatsSummary />
      </div>
    );
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Repository statistics summary on mobile devices."
      }
    }
  }
};