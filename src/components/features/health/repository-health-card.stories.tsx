import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { vi } from "vitest";
import { RepositoryHealthCard } from "./repository-health-card";
import { MemoryRouter } from "react-router-dom";
import { RepoStatsContext } from "@/lib/repo-stats-context";

// Mock functions
const mockGetDaysAgo = fn().mockReturnValue(30);
const mockHandleSync = fn();
const mockUseOnDemandSync = fn(() => ({
  isInitialSync: false,
  isSyncing: false,
  syncLogs: null,
  handleSync: mockHandleSync,
}));

const mockUseTimeRangeStore = fn(() => ({
  getDaysAgo: mockGetDaysAgo,
}));

const mockUseAutoTrackRepository = fn();

const mockSupabase = {
  from: fn().mockReturnValue({
    select: fn().mockReturnValue({
      eq: fn().mockReturnValue({
        gte: fn().mockReturnValue({
          order: fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    }),
  }),
};

const mockCalculateHealthMetrics = fn().mockReturnValue({
  overallHealth: 85,
  healthFactors: {
    documentation: 80,
    testing: 75,
    codeQuality: 90,
    maintainerActivity: 88,
  },
});

const MockRepositoryHealthOverall = () => <div>Repository Health Overall</div>;
const MockRepositoryHealthFactors = () => <div>Repository Health Factors</div>;
const MockLotteryFactor = () => <div>Lottery Factor</div>;
const MockSelfSelectionRate = () => <div>Self Selection Rate</div>;
const MockContributorConfidenceCard = () => <div>Contributor Confidence Card</div>;

// Apply mocks
vi.mock("@/lib/time-range-store", () => ({
  useTimeRangeStore: mockUseTimeRangeStore
}));

vi.mock("@/hooks/use-auto-track-repository", () => ({
  useAutoTrackRepository: mockUseAutoTrackRepository
}));

vi.mock("@/hooks/use-on-demand-sync", () => ({
  useOnDemandSync: mockUseOnDemandSync
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase
}));

vi.mock("@/lib/insights/health-metrics", () => ({
  calculateHealthMetrics: mockCalculateHealthMetrics
}));

vi.mock("@/components/insights/sections/repository-health-overall", () => ({
  RepositoryHealthOverall: MockRepositoryHealthOverall
}));

vi.mock("@/components/insights/sections/repository-health-factors", () => ({
  RepositoryHealthFactors: MockRepositoryHealthFactors
}));

vi.mock("./lottery-factor", () => ({
  default: MockLotteryFactor
}));

vi.mock("@/components/features/contributor/self-selection-rate", () => ({
  SelfSelectionRate: MockSelfSelectionRate
}));

vi.mock("./contributor-confidence-card", () => ({
  ContributorConfidenceCard: MockContributorConfidenceCard
}));

// Mock data
const mockPullRequests = [
  {
    id: 1,
    number: 123,
    title: "Add authentication system",
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
    title: "Bot: Update dependencies",
    state: "closed" as const,
    created_at: "2024-01-11T09:15:00Z",
    updated_at: "2024-01-11T09:30:00Z",
    merged_at: "2024-01-11T09:30:00Z",
    additions: 45,
    deletions: 12,
    repository_owner: "facebook",
    repository_name: "react",
    user: {
      id: 2,
      login: "dependabot[bot]",
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
      type: "Bot" as const,
    },
    html_url: "https://github.com/facebook/react/pull/124",
    reviews: [],
    comments: [],
  },
];

// Mock lottery factor data
const defaultLotteryFactor = {
  topContributorsCount: 3,
  totalContributors: 12,
  topContributorsPercentage: 75,
  contributors: [
    {
      login: "alice-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      pullRequests: 8,
      percentage: 40
    },
    {
      login: "bob-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
      pullRequests: 5,
      percentage: 25
    },
    {
      login: "charlie-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
      pullRequests: 2,
      percentage: 10
    }
  ],
  riskLevel: 'Medium' as const
};

const meta = {
  title: "Features/Health/RepositoryHealthCard",
  component: RepositoryHealthCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A comprehensive repository health analysis card that displays overall health score, lottery factor, contributor confidence, health factors, and self-selection rates."
      }
    }
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/health"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: defaultLotteryFactor,
            directCommitsData: null,
          }}
        >
          <div className="w-[900px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof RepositoryHealthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <RepositoryHealthCard />,
  parameters: {
    docs: {
      description: {
        story: "Default repository health card showing comprehensive health metrics."
      }
    }
  }
};

export const WithBots: Story = {
  render: () => <RepositoryHealthCard />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/health"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: true,
            setIncludeBots: () => {},
            lotteryFactor: {
              topContributorsCount: 3,
              totalContributors: 10,
              topContributorsPercentage: 80,
              contributors: [
                {
                  login: "alice-dev",
                  avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
                  pullRequests: 12,
                  percentage: 50
                },
                {
                  login: "bob-dev",
                  avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
                  pullRequests: 5,
                  percentage: 20
                },
                {
                  login: "dependabot[bot]",
                  avatar_url: "https://avatars.githubusercontent.com/u/49699333?v=4",
                  pullRequests: 3,
                  percentage: 10
                }
              ],
              riskLevel: 'High' as const
            },
            directCommitsData: null,
          }}
        >
          <div className="w-[900px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository health card with bot contributions included and bot toggle visible."
      }
    }
  }
};

export const WithDirectCommits: Story = {
  render: () => <RepositoryHealthCard />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/health"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: {
              topContributorsCount: 2,
              totalContributors: 8,
              topContributorsPercentage: 60,
              contributors: [
                {
                  login: "admin-user",
                  avatar_url: "https://avatars.githubusercontent.com/u/4?v=4",
                  pullRequests: 15,
                  percentage: 45
                },
                {
                  login: "senior-dev",
                  avatar_url: "https://avatars.githubusercontent.com/u/5?v=4",
                  pullRequests: 8,
                  percentage: 15
                }
              ],
              riskLevel: 'Low' as const
            },
            directCommitsData: {
              hasYoloCoders: true,
              yoloCoderStats: [
                { 
                  login: "admin-user", 
                  avatar_url: "https://avatars.githubusercontent.com/u/4?v=4",
                  directCommits: 15,
                  totalCommits: 25,
                  directCommitPercentage: 60,
                  type: "User" as const
                },
                { 
                  login: "senior-dev", 
                  avatar_url: "https://avatars.githubusercontent.com/u/5?v=4",
                  directCommits: 8,
                  totalCommits: 20,
                  directCommitPercentage: 50,
                  type: "User" as const
                }
              ]
            },
          }}
        >
          <div className="w-[900px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository health card showing warning indicators for direct commits (YOLO coders)."
      }
    }
  }
};

export const LoadingState: Story = {
  render: () => <RepositoryHealthCard />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/health"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: [],
              loading: true,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: null,
            directCommitsData: null,
          }}
        >
          <div className="w-[900px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository health card in loading state while data is being fetched."
      }
    }
  }
};

export const ConfidenceError: Story = {
  render: () => {
    // Mock confidence calculation error
    mockSupabase.from.mockReturnValue({
      select: fn().mockReturnValue({
        eq: fn().mockReturnValue({
          gte: fn().mockReturnValue({
            order: fn().mockResolvedValue({
              data: null,
              error: new Error("Failed to calculate confidence"),
            }),
          }),
        }),
      }),
    });

    return <RepositoryHealthCard />;
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/health"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: defaultLotteryFactor,
            directCommitsData: null,
          }}
        >
          <div className="w-[900px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository health card showing error state for contributor confidence calculation."
      }
    }
  }
};

export const SyncInProgress: Story = {
  render: () => {
    // Mock sync in progress
    mockUseOnDemandSync.mockReturnValue({
      isInitialSync: true,
      isSyncing: true,
      syncLogs: null,
      handleSync: mockHandleSync,
    });

    return <RepositoryHealthCard />;
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/health"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: defaultLotteryFactor,
            directCommitsData: null,
          }}
        >
          <div className="w-[900px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository health card showing state during data synchronization."
      }
    }
  }
};

export const HighActivity: Story = {
  render: () => <RepositoryHealthCard />,
  decorators: [
    (Story) => {
      const highActivityPRs = Array.from({ length: 50 }, (_, i) => ({
        ...mockPullRequests[0],
        id: i + 1,
        number: i + 100,
        user: {
          ...mockPullRequests[0].user,
          login: `contributor-${i % 8}`,
          id: i % 8
        }
      }));

      return (
        <MemoryRouter initialEntries={["/kubernetes/kubernetes/health"]}>
          <RepoStatsContext.Provider
            value={{
              stats: {
                pullRequests: highActivityPRs,
                loading: false,
                error: null,
              },
              includeBots: false,
              setIncludeBots: () => {},
              lotteryFactor: {
                topContributorsCount: 5,
                totalContributors: 8,
                topContributorsPercentage: 85,
                contributors: [
                  {
                    login: "contributor-0",
                    avatar_url: "https://avatars.githubusercontent.com/u/10?v=4",
                    pullRequests: 20,
                    percentage: 40
                  },
                  {
                    login: "contributor-1",
                    avatar_url: "https://avatars.githubusercontent.com/u/11?v=4",
                    pullRequests: 15,
                    percentage: 30
                  },
                  {
                    login: "contributor-2",
                    avatar_url: "https://avatars.githubusercontent.com/u/12?v=4",
                    pullRequests: 8,
                    percentage: 15
                  }
                ],
                riskLevel: 'High' as const
              },
              directCommitsData: null,
            }}
          >
            <div className="w-[900px] p-4">
              <Story />
            </div>
          </RepoStatsContext.Provider>
        </MemoryRouter>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository health card for a high-activity repository with many contributors."
      }
    }
  }
};

export const MobileView: Story = {
  render: () => <RepositoryHealthCard />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/health"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: defaultLotteryFactor,
            directCommitsData: null,
          }}
        >
          <div className="w-full p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Repository health card on mobile devices with responsive layout."
      }
    }
  }
};