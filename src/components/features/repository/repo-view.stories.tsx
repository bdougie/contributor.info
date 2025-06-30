import type { Meta, StoryObj } from "@storybook/react";
import RepoView, { ContributionsRoute, LotteryFactorRoute, DistributionRoute } from "./repo-view";
import { MemoryRouter } from "react-router-dom";

// Mock all the dependencies
vi.mock("@/lib/time-range-store", () => ({
  useTimeRangeStore: vi.fn(() => ({
    timeRange: "30d"
  }))
}));

vi.mock("@/hooks/use-cached-repo-data", () => ({
  useCachedRepoData: vi.fn(() => ({
    stats: {
      pullRequests: [
        {
          id: 1,
          title: "Add new feature",
          state: "closed",
          created_at: "2024-01-15T10:30:00Z",
          merged_at: "2024-01-15T12:00:00Z",
          user: {
            login: "alice",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4"
          }
        }
      ],
      loading: false,
      error: null
    },
    lotteryFactor: 2.5,
    directCommitsData: null
  }))
}));

vi.mock("@/hooks/use-repo-search", () => ({
  useRepoSearch: vi.fn(() => ({
    searchInput: "",
    setSearchInput: vi.fn(),
    handleSearch: vi.fn(),
    handleSelectExample: vi.fn()
  }))
}));

// Mock the child components
vi.mock("../health", () => ({
  RepositoryHealthCard: () => (
    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
      <h3 className="text-lg font-semibold mb-2">Repository Health Card</h3>
      <p className="text-muted-foreground">Health metrics and lottery factor analysis</p>
    </div>
  )
}));

vi.mock("../activity", () => ({
  Contributions: () => (
    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
      <h3 className="text-lg font-semibold mb-2">Contributions Chart</h3>
      <p className="text-muted-foreground">Pull request contribution visualization</p>
    </div>
  ),
  MetricsAndTrendsCard: ({ owner, repo }: { owner: string, repo: string }) => (
    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
      <h3 className="text-lg font-semibold mb-2">Metrics and Trends</h3>
      <p className="text-muted-foreground">Analysis for {owner}/{repo}</p>
    </div>
  )
}));

vi.mock("../distribution", () => ({
  Distribution: () => (
    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
      <h3 className="text-lg font-semibold mb-2">Distribution Chart</h3>
      <p className="text-muted-foreground">Contributor distribution analysis</p>
    </div>
  )
}));

vi.mock("../contributor", () => ({
  ContributorOfMonthWrapper: () => (
    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
      <h3 className="text-lg font-semibold mb-2">Contributor of the Month</h3>
      <p className="text-muted-foreground">Featured contributor spotlight</p>
    </div>
  )
}));

vi.mock("./example-repos", () => ({
  ExampleRepos: ({ onSelect }: { onSelect: (repo: string) => void }) => (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        onClick={() => onSelect("facebook/react")}
        className="text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
      >
        facebook/react
      </button>
      <button
        onClick={() => onSelect("microsoft/vscode")}
        className="text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
      >
        microsoft/vscode
      </button>
    </div>
  )
}));

vi.mock("@/components/insights/insights-sidebar", () => ({
  InsightsSidebar: () => (
    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white">
      💡
    </div>
  )
}));

vi.mock("@/components/skeletons", () => ({
  RepoViewSkeleton: () => (
    <div className="container mx-auto py-2">
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  )
}));

vi.mock("./repo-not-found", () => ({
  default: () => (
    <div className="container mx-auto py-2">
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Repository Not Found</h2>
        <p className="text-muted-foreground">The repository you're looking for doesn't exist.</p>
      </div>
    </div>
  )
}));

vi.mock("@/components/common/layout", () => ({
  SocialMetaTags: ({ title }: { title: string }) => (
    <div data-testid="social-meta-tags" className="hidden">
      <meta name="title" content={title} />
    </div>
  )
}));

vi.mock("@/lib/dub", () => ({
  createChartShareUrl: vi.fn().mockResolvedValue("https://oss.fyi/abc123"),
  getDubConfig: vi.fn().mockReturnValue({ isDev: false })
}));

vi.mock("@/lib/repo-stats-context", () => ({
  RepoStatsProvider: ({ children, value }: any) => (
    <div data-testid="repo-stats-provider">
      {children}
    </div>
  )
}));

const meta = {
  title: "Features/Repository/RepoView",
  component: RepoView,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The main repository view component that displays comprehensive analysis of GitHub repositories including contributions, health metrics, distribution, and activity feeds."
      }
    }
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof RepoView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <RepoView />,
  parameters: {
    docs: {
      description: {
        story: "Default repository view showing the main analysis interface."
      }
    }
  }
};

export const LoadingState: Story = {
  render: () => {
    // Mock loading state
    vi.mock("@/hooks/use-cached-repo-data", () => ({
      useCachedRepoData: vi.fn(() => ({
        stats: {
          pullRequests: [],
          loading: true,
          error: null
        },
        lotteryFactor: null,
        directCommitsData: null
      }))
    }));

    return <RepoView />;
  },
  parameters: {
    docs: {
      description: {
        story: "Repository view in loading state while fetching data."
      }
    }
  }
};

export const ErrorState: Story = {
  render: () => {
    // Mock error state
    vi.mock("@/hooks/use-cached-repo-data", () => ({
      useCachedRepoData: vi.fn(() => ({
        stats: {
          pullRequests: [],
          loading: false,
          error: "Failed to fetch repository data. Please try again."
        },
        lotteryFactor: null,
        directCommitsData: null
      }))
    }));

    return <RepoView />;
  },
  parameters: {
    docs: {
      description: {
        story: "Repository view showing error state when data fetching fails."
      }
    }
  }
};

export const RepositoryNotFound: Story = {
  render: () => {
    // Mock 404 error
    vi.mock("@/hooks/use-cached-repo-data", () => ({
      useCachedRepoData: vi.fn(() => ({
        stats: {
          pullRequests: [],
          loading: false,
          error: "Repository not found"
        },
        lotteryFactor: null,
        directCommitsData: null
      }))
    }));

    return <RepoView />;
  },
  parameters: {
    docs: {
      description: {
        story: "Repository view when the requested repository doesn't exist."
      }
    }
  }
};

export const WithHealthTab: Story = {
  render: () => (
    <MemoryRouter initialEntries={["/facebook/react/health"]}>
      <RepoView />
    </MemoryRouter>
  ),
  parameters: {
    docs: {
      description: {
        story: "Repository view with health tab active showing repository health metrics."
      }
    }
  }
};

export const WithDistributionTab: Story = {
  render: () => (
    <MemoryRouter initialEntries={["/facebook/react/distribution"]}>
      <RepoView />
    </MemoryRouter>
  ),
  parameters: {
    docs: {
      description: {
        story: "Repository view with distribution tab active showing contributor distribution."
      }
    }
  }
};

export const WithFeedTab: Story = {
  render: () => (
    <MemoryRouter initialEntries={["/facebook/react/feed"]}>
      <RepoView />
    </MemoryRouter>
  ),
  parameters: {
    docs: {
      description: {
        story: "Repository view with feed tab active showing activity feed."
      }
    }
  }
};

export const ContributionsRouteStory: Story = {
  render: () => (
    <MemoryRouter initialEntries={["/facebook/react"]}>
      <div className="container mx-auto py-4">
        <ContributionsRoute />
      </div>
    </MemoryRouter>
  ),
  parameters: {
    docs: {
      description: {
        story: "Standalone contributions route component showing activity analysis."
      }
    }
  }
};

export const LotteryFactorRouteStory: Story = {
  render: () => (
    <MemoryRouter initialEntries={["/facebook/react/health"]}>
      <div className="container mx-auto py-4">
        <LotteryFactorRoute />
      </div>
    </MemoryRouter>
  ),
  parameters: {
    docs: {
      description: {
        story: "Standalone lottery factor route component showing health metrics."
      }
    }
  }
};

export const DistributionRouteStory: Story = {
  render: () => (
    <MemoryRouter initialEntries={["/facebook/react/distribution"]}>
      <div className="container mx-auto py-4">
        <DistributionRoute />
      </div>
    </MemoryRouter>
  ),
  parameters: {
    docs: {
      description: {
        story: "Standalone distribution route component showing contributor distribution."
      }
    }
  }
};

export const MobileView: Story = {
  render: () => <RepoView />,
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Repository view on mobile devices with responsive layout."
      }
    }
  }
};