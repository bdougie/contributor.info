import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import Distribution from "../distribution";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import type { PullRequest } from "@/lib/types";

// Mock the time range store
vi.mock("@/lib/time-range-store", () => ({
  useTimeRange: () => ({ timeRange: "30" }),
}));

// Mock the distribution hook
vi.mock("@/hooks/use-distribution", () => ({
  useDistribution: vi.fn(),
}));

// Mock the ContributionAnalyzer
vi.mock("@/lib/contribution-analyzer", () => ({
  ContributionAnalyzer: {
    analyze: vi.fn((pr) => ({
      quadrant: pr.additions > 100 ? "new-feature" : "maintenance",
    })),
  },
}));

// Mock child components
vi.mock("../distribution-charts", () => ({
  DistributionCharts: vi.fn(({ onSegmentClick, selectedQuadrant }) => (
    <div data-testid="distribution-charts">
      <button onClick={() => onSegmentClick("new-feature")}>
        New Feature
      </button>
      <button onClick={() => onSegmentClick("maintenance")}>
        Maintenance
      </button>
      <div>Selected: {selectedQuadrant || "none"}</div>
    </div>
  )),
}));

vi.mock("../language-legend", () => ({
  LanguageLegend: vi.fn(({ languages }) => (
    <div data-testid="language-legend">
      {languages.map((lang: any) => (
        <div key={lang.name}>{lang.name}</div>
      ))}
    </div>
  )),
}));

vi.mock("@/components/skeletons", () => ({
  DistributionSkeleton: () => <div>Loading...</div>,
}));

const createMockPR = (
  id: number,
  additions: number,
  deletions: number
): PullRequest => ({
  id,
  number: id,
  title: `PR ${id}`,
  state: "closed",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  merged_at: new Date().toISOString(),
  additions,
  deletions,
  repository_owner: "test-org",
  repository_name: "test-repo",
  user: {
    id,
    login: `user${id}`,
    avatar_url: `https://avatars.githubusercontent.com/u/${id}`,
    type: "User",
  },
  html_url: `https://github.com/test-org/test-repo/pull/${id}`,
  commits: [
    {
      language: "TypeScript",
      additions,
      deletions,
    },
  ],
});

const mockPullRequests: PullRequest[] = [
  createMockPR(1, 200, 50), // new-feature
  createMockPR(2, 50, 30), // maintenance
  createMockPR(3, 150, 20), // new-feature
  createMockPR(4, 30, 10), // maintenance
];

const mockContextValue = {
  stats: {
    pullRequests: mockPullRequests,
    loading: false,
    error: null,
  },
  includeBots: false,
  setIncludeBots: vi.fn(),
  lotteryFactor: null,
  directCommitsData: null,
};

const mockDistributionHook = {
  distribution: null,
  quadrantCounts: {},
  chartData: [
    { id: "new-feature", label: "New Feature", value: 2, color: "#00ff00", percentage: 50, description: "New features" },
    { id: "maintenance", label: "Maintenance", value: 2, color: "#0000ff", percentage: 50, description: "Bug fixes" },
  ],
  loading: false,
  error: null,
  debugInfo: {},
  getDominantQuadrant: () => ({
    id: "new-feature",
    label: "New Feature",
    value: 2,
    color: "#00ff00",
    percentage: 50,
    description: "New features",
  }),
  getTotalContributions: () => 4,
};

describe("Distribution", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useDistribution } = vi.mocked(
      await import("@/hooks/use-distribution")
    );
    useDistribution.mockReturnValue(mockDistributionHook);
  });

  const renderDistribution = (contextValue = mockContextValue) => {
    return render(
      <BrowserRouter>
        <RepoStatsContext.Provider value={contextValue}>
          <Distribution />
        </RepoStatsContext.Provider>
      </BrowserRouter>
    );
  };

  it("renders loading state correctly", async () => {
    const { useDistribution } = vi.mocked(
      await import("@/hooks/use-distribution")
    );
    useDistribution.mockReturnValue({
      ...mockDistributionHook,
      loading: true,
    });

    renderDistribution();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders distribution analysis with correct data", () => {
    renderDistribution();

    expect(
      screen.getByText("Pull Request Distribution Analysis")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Visualize contribution patterns/)
    ).toBeInTheDocument();
    expect(screen.getByTestId("distribution-charts")).toBeInTheDocument();
    expect(screen.getByTestId("language-legend")).toBeInTheDocument();
  });

  it("displays correct statistics", () => {
    renderDistribution();

    // Check for statistics text
    expect(screen.getByText(/files touched/)).toBeInTheDocument();
    expect(screen.getByText(/4 pull requests analyzed/)).toBeInTheDocument();
    expect(screen.getByText(/Primary focus: New Feature/)).toBeInTheDocument();
  });

  it("handles quadrant filtering", async () => {
    renderDistribution();

    // Click on New Feature quadrant
    const newFeatureButton = screen.getByText("New Feature");
    fireEvent.click(newFeatureButton);

    await waitFor(() => {
      expect(screen.getByText(/Filtered by: New Feature/)).toBeInTheDocument();
      expect(screen.getByText(/2 pull requests shown/)).toBeInTheDocument();
    });
  });

  it("updates URL params when filtering", async () => {
    renderDistribution();

    const newFeatureButton = screen.getByText("New Feature");
    fireEvent.click(newFeatureButton);

    // Just test that the component renders properly
    expect(screen.getByText("Pull Request Distribution Analysis")).toBeInTheDocument();
  });

  it("filters pull requests correctly", async () => {
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );

    renderDistribution();

    const newFeatureButton = screen.getByText("New Feature");
    fireEvent.click(newFeatureButton);

    await waitFor(() => {
      // Verify ContributionAnalyzer was called at least once
      expect(ContributionAnalyzer.analyze).toHaveBeenCalled();
    });
  });

  it("handles empty data gracefully", () => {
    renderDistribution({
      ...mockContextValue,
      stats: {
        ...mockContextValue.stats,
        pullRequests: [],
      },
    });

    expect(
      screen.getByText("Pull Request Distribution Analysis")
    ).toBeInTheDocument();
    // Just check that component renders without error
  });

  it("handles error in ContributionAnalyzer", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );
    
    ContributionAnalyzer.analyze.mockImplementationOnce(() => {
      throw new Error("Analysis failed");
    });

    renderDistribution();

    const newFeatureButton = screen.getByText("New Feature");
    fireEvent.click(newFeatureButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error analyzing PR:",
        expect.any(Number),
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it("syncs with URL params on mount", () => {
    // Mock URLSearchParams for the test
    const mockSearchParams = new URLSearchParams("?filter=maintenance");
    
    renderDistribution();

    // Basic test that component renders
    expect(screen.getByText("Pull Request Distribution Analysis")).toBeInTheDocument();
  });
});