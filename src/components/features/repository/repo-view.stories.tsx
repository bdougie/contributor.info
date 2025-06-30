import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { vi } from "vitest";
import RepoView, { ContributionsRoute, LotteryFactorRoute, DistributionRoute } from "./repo-view";
import { MemoryRouter } from "react-router-dom";

// Mock all the dependencies
const mockTimeRangeStore = fn(() => ({
  timeRange: "30d"
}));

const mockCachedRepoData = fn(() => ({
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
}));

const mockRepoSearch = fn(() => ({
  searchInput: "",
  setSearchInput: fn(),
  handleSearch: fn(),
  handleSelectExample: fn()
}));

// Apply mocks
vi.mock("@/lib/time-range-store", () => ({
  useTimeRangeStore: mockTimeRangeStore
}));

vi.mock("@/hooks/use-cached-repo-data", () => ({
  useCachedRepoData: mockCachedRepoData
}));

vi.mock("@/hooks/use-repo-search", () => ({
  useRepoSearch: mockRepoSearch
}));

// Mock components for Storybook
export const RepositoryHealthCard = () => (
  <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
    <h3 className="text-lg font-semibold mb-2">Repository Health Card</h3>
    <p className="text-muted-foreground">Health metrics and lottery factor analysis</p>
  </div>
);

export const Contributions = () => (
  <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
    <h3 className="text-lg font-semibold mb-2">Contributions Chart</h3>
    <p className="text-muted-foreground">Pull request contribution visualization</p>
  </div>
);

export const MetricsAndTrendsCard = ({ owner, repo }: { owner: string; repo: string }) => (
  <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
    <h3 className="text-lg font-semibold mb-2">Metrics and Trends</h3>
    <p className="text-muted-foreground">
      Analysis for {owner}/{repo}
    </p>
  </div>
);

export const Distribution = () => (
  <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
    <h3 className="text-lg font-semibold mb-2">Distribution Chart</h3>
    <p className="text-muted-foreground">Contributor distribution analysis</p>
  </div>
);

export const ContributorOfMonthWrapper = () => (
  <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
    <h3 className="text-lg font-semibold mb-2">Contributor of the Month</h3>
    <p className="text-muted-foreground">Featured contributor spotlight</p>
  </div>
);

export const ExampleRepos = ({ onSelect }: { onSelect: (repo: string) => void }) => (
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
);

export const InsightsSidebar = () => (
  <div className="fixed right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white">
    💡
  </div>
);

export const RepoViewSkeleton = () => (
  <div className="container mx-auto py-2">
    <div className="animate-pulse space-y-4">
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  </div>
);

export const RepoNotFound = () => (
  <div className="container mx-auto py-2">
    <div className="text-center py-16">
      <h2 className="text-2xl font-bold mb-4">Repository Not Found</h2>
      <p className="text-muted-foreground">
        The repository you're looking for doesn't exist.
      </p>
    </div>
  </div>
);

export const SocialMetaTags = ({ title }: { title: string }) => (
  <div data-testid="social-meta-tags" className="hidden">
    <meta name="title" content={title} />
  </div>
);

// Mock dub functions
const mockCreateChartShareUrl = fn().mockResolvedValue("https://oss.fyi/abc123");
const mockGetDubConfig = fn().mockReturnValue({ isDev: false });

vi.mock("@/lib/dub", () => ({
  createChartShareUrl: mockCreateChartShareUrl,
  getDubConfig: mockGetDubConfig
}));

export const RepoStatsProvider = ({ children }: any) => (
  <div data-testid="repo-stats-provider">{children}</div>
);

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
    )
  ]
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
    // Override the mock for loading state
    mockCachedRepoData.mockReturnValue({
      stats: {
        pullRequests: [],
        loading: true,
        error: null
      },
      lotteryFactor: null,
      directCommitsData: null
    });

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
    // Override the mock for error state
    mockCachedRepoData.mockReturnValue({
      stats: {
        pullRequests: [],
        loading: false,
        error: "Failed to fetch repository data. Please try again."
      },
      lotteryFactor: null,
      directCommitsData: null
    });

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

export const ContributionsPage: Story = {
  render: () => <ContributionsRoute />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/contributions"]}>
        <Story />
      </MemoryRouter>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository contributions page showing detailed contribution analytics."
      }
    }
  }
};

export const LotteryFactorPage: Story = {
  render: () => <LotteryFactorRoute />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/lottery-factor"]}>
        <Story />
      </MemoryRouter>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository lottery factor page showing contributor concentration risk analysis."
      }
    }
  }
};

export const DistributionPage: Story = {
  render: () => <DistributionRoute />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react/distribution"]}>
        <Story />
      </MemoryRouter>
    )
  ],
  parameters: {
    docs: {
      description: {
        story: "Repository distribution page showing contributor distribution patterns."
      }
    }
  }
};

export const WithSearchQuery: Story = {
  render: () => {
    // Override the mock with search input
    mockRepoSearch.mockReturnValue({
      searchInput: "microsoft/vscode",
      setSearchInput: fn(),
      handleSearch: fn(),
      handleSelectExample: fn()
    });

    return <RepoView />;
  },
  parameters: {
    docs: {
      description: {
        story: "Repository view with an active search query in the input field."
      }
    }
  }
};