import type { Meta, StoryObj } from "@storybook/react";
import { RepositoryHealthCard } from "./repository-health-card";
import { MemoryRouter } from "react-router-dom";
import { RepoStatsContext } from "@/lib/repo-stats-context";

// Mock all the hooks and dependencies
vi.mock("@/lib/time-range-store", () => ({
  useTimeRangeStore: vi.fn(() => ({
    timeRange: "30d"
  }))
}));

vi.mock("@/hooks/use-auto-track-repository", () => ({
  useAutoTrackRepository: vi.fn()
}));

vi.mock("@/hooks/use-on-demand-sync", () => ({
  useOnDemandSync: vi.fn(() => ({
    syncStatus: {
      isTriggering: false,
      isInProgress: false,
      isComplete: false
    }
  }))
}));

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              avg_confidence_score: 3.2,
              contributor_count: 15
            },
            error: null
          })
        })
      })
    })
  }
}));

// Mock the health metrics calculation
vi.mock("@/lib/insights/health-metrics", () => ({
  calculateRepositoryConfidence: vi.fn().mockResolvedValue({
    score: 3.2,
    breakdown: {
      starForkConfidence: 1.12,
      engagementConfidence: 0.8,
      retentionConfidence: 0.8,
      qualityConfidence: 0.48,
      totalStargazers: 45000,
      totalForkers: 8500,
      contributorCount: 15,
      conversionRate: 3.2
    }
  })
}));

// Mock child components
vi.mock("@/components/insights/sections/repository-health-overall", () => ({
  RepositoryHealthOverall: ({ stats }: any) => (
    <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
      <h3 className="text-lg font-semibold mb-2">Repository Health Overall</h3>
      <div className="text-3xl font-bold text-green-600">B+</div>
      <p className="text-muted-foreground">
        {stats.pullRequests.length} PRs analyzed
      </p>
    </div>
  )
}));

vi.mock("@/components/insights/sections/repository-health-factors", () => ({
  RepositoryHealthFactors: ({ repositoryName }: { repositoryName: string }) => (
    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
      <h3 className="text-sm font-semibold mb-2">Health Factors</h3>
      <p className="text-xs text-muted-foreground">{repositoryName}</p>
      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
        <div>Code Quality: 85%</div>
        <div>Review Coverage: 92%</div>
        <div>Response Time: 2.3d</div>
        <div>Contributor Diversity: Good</div>
      </div>
    </div>
  )
}));

vi.mock("./lottery-factor", () => ({
  LotteryFactorContent: ({ lotteryFactor, showYoloButton }: any) => (
    <div className="text-center">
      <h3 className="text-lg font-semibold mb-2">Lottery Factor</h3>
      <div className="text-3xl font-bold text-blue-600">
        {lotteryFactor || "2.5"}
      </div>
      <p className="text-sm text-muted-foreground">Contributors needed to cover 50% of code</p>
      {showYoloButton && (
        <div className="mt-2 text-xs text-amber-600">⚠️ Direct commits detected</div>
      )}
    </div>
  )
}));

vi.mock("@/components/features/contributor/self-selection-rate", () => ({
  SelfSelectionRate: ({ owner, repo }: { owner: string, repo: string }) => (
    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
      <h3 className="text-sm font-semibold mb-2">Self-Selection Rate</h3>
      <div className="text-2xl font-bold text-purple-600">67%</div>
      <p className="text-xs text-muted-foreground">
        Contributors active in {owner}/{repo}
      </p>
    </div>
  )
}));

vi.mock("./contributor-confidence-card", () => ({
  ContributorConfidenceCard: ({ confidenceScore, loading, error, owner, repo }: any) => (
    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
      <h3 className="text-sm font-semibold mb-2">Contributor Confidence</h3>
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-xs">{error}</div>
      ) : (
        <>
          <div className="text-2xl font-bold text-green-600">
            {confidenceScore?.toFixed(1) || "3.2"}
          </div>
          <p className="text-xs text-muted-foreground">
            High confidence in {owner}/{repo}
          </p>
        </>
      )}
    </div>
  )
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
            lotteryFactor: 2.5,
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
            lotteryFactor: 2.8,
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
            lotteryFactor: 1.8,
            directCommitsData: {
              hasYoloCoders: true,
              yoloCoderStats: [
                { login: "admin-user", directCommits: 15 },
                { login: "senior-dev", directCommits: 8 }
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
    vi.mock("@/lib/supabase", () => ({
      supabase: {
        rpc: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error("Database connection failed"))
            })
          })
        })
      }
    }));

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
            lotteryFactor: 2.5,
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
    vi.mock("@/hooks/use-on-demand-sync", () => ({
      useOnDemandSync: vi.fn(() => ({
        syncStatus: {
          isTriggering: false,
          isInProgress: true,
          isComplete: false
        }
      }))
    }));

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
            lotteryFactor: 2.5,
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
              lotteryFactor: 4.2,
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
            lotteryFactor: 2.5,
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