import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DistributionCharts } from "../distribution-charts";
import type { QuadrantData } from "@/hooks/use-distribution";
import type { PullRequest } from "@/lib/types";

// Mock recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children, onClick }: any) => (
    <div data-testid="pie" onClick={() => onClick({ id: "new-feature" })}>
      {children}
    </div>
  ),
  Cell: ({ fill }: any) => <div data-testid="cell" style={{ backgroundColor: fill }} />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children, onClick }: any) => (
    <div data-testid="bar" onClick={() => onClick({ id: "maintenance" })}>
      {children}
    </div>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

// Mock the enhanced treemap component
vi.mock("../distribution-treemap-enhanced", () => ({
  DistributionTreemapEnhanced: vi.fn(({ onDrillDown, onDrillUp, onNodeClick }) => (
    <div data-testid="treemap-enhanced">
      <button onClick={() => onDrillDown("new-feature")}>Drill Down</button>
      <button onClick={() => onDrillUp()}>Drill Up</button>
      <button onClick={() => onNodeClick("contributor1")}>Node Click</button>
    </div>
  )),
}));

// Mock the hierarchical distribution hook
vi.mock("@/hooks/use-hierarchical-distribution", () => ({
  useHierarchicalDistribution: vi.fn(() => ({
    hierarchicalData: { name: "root", children: [] },
    currentView: "quadrant",
    selectedQuadrant: null,
    drillDown: vi.fn(),
    drillUp: vi.fn(),
  })),
}));

const mockData: QuadrantData[] = [
  {
    id: "new-feature",
    label: "New Feature",
    value: 10,
    color: "#00ff00",
    percentage: 40,
    description: "New functionality added",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    value: 8,
    color: "#0000ff",
    percentage: 32,
    description: "Bug fixes and updates",
  },
  {
    id: "refactoring",
    label: "Refactoring",
    value: 5,
    color: "#ff0000",
    percentage: 20,
    description: "Code improvements",
  },
  {
    id: "refinement",
    label: "Refinement",
    value: 2,
    color: "#00ffff",
    percentage: 8,
    description: "Code cleanup",
  },
];

const createMockPR = (
  id: number,
  additions: number,
  deletions: number,
  language = "TypeScript"
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
      language,
      additions,
      deletions,
    },
  ],
});

const mockPullRequests: PullRequest[] = [
  createMockPR(1, 200, 50, "TypeScript"),
  createMockPR(2, 50, 30, "JavaScript"),
  createMockPR(3, 150, 20, "CSS"),
  createMockPR(4, 30, 10, "Python"),
];

describe("DistributionCharts", () => {
  const mockOnSegmentClick = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window size
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  const renderCharts = (props = {}) => {
    return render(
      <DistributionCharts
        data={mockData}
        onSegmentClick={mockOnSegmentClick}
        filteredPRs={mockPullRequests}
        selectedQuadrant={null}
        pullRequests={mockPullRequests}
        {...props}
      />
    );
  };

  it("renders with default treemap view", () => {
    renderCharts();
    
    expect(screen.getByText("Contribution Breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("treemap-enhanced")).toBeInTheDocument();
    
    // Check chart type buttons
    expect(screen.getByRole("button", { name: /treemap/i })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: /donut/i })).not.toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: /bar/i })).not.toHaveClass("bg-primary");
  });

  it("switches between chart types", async () => {
    renderCharts();
    
    // Switch to donut chart
    const donutButton = screen.getByRole("button", { name: /donut/i });
    fireEvent.click(donutButton);
    
    await waitFor(() => {
      expect(screen.getAllByTestId("pie-chart")[0]).toBeInTheDocument();
      expect(screen.queryByTestId("treemap-enhanced")).not.toBeInTheDocument();
    });
    
    // Switch to bar chart
    const barButton = screen.getByRole("button", { name: /bar/i });
    fireEvent.click(barButton);
    
    await waitFor(() => {
      expect(screen.getAllByTestId("bar-chart")[0]).toBeInTheDocument();
      expect(screen.queryAllByTestId("pie-chart")).toHaveLength(0);
    });
  });

  it("renders legend with correct data", () => {
    renderCharts();
    
    mockData.forEach(item => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
      expect(screen.getByText(item.description)).toBeInTheDocument();
      expect(screen.getByText(`${item.value} PRs (${item.percentage.toFixed(1)}%)`)).toBeInTheDocument();
    });
  });

  it("handles segment click in legend", () => {
    renderCharts();
    
    const newFeatureButton = screen.getByRole("button", { name: /new feature/i });
    fireEvent.click(newFeatureButton);
    
    expect(mockOnSegmentClick).toHaveBeenCalledWith("new-feature");
  });

  it("handles segment click in pie chart", async () => {
    renderCharts();
    
    // Switch to donut chart
    fireEvent.click(screen.getByRole("button", { name: /donut/i }));
    
    await waitFor(() => {
      const pie = screen.getByTestId("pie");
      fireEvent.click(pie);
      expect(mockOnSegmentClick).toHaveBeenCalledWith("new-feature");
    });
  });

  it("handles segment click in bar chart", async () => {
    renderCharts();
    
    // Switch to bar chart
    fireEvent.click(screen.getByRole("button", { name: /bar/i }));
    
    await waitFor(() => {
      const bar = screen.getByTestId("bar");
      fireEvent.click(bar);
      expect(mockOnSegmentClick).toHaveBeenCalledWith("maintenance");
    });
  });

  it("shows PR drawer when quadrant is selected in treemap mode", async () => {
    renderCharts({ selectedQuadrant: "new-feature" });
    
    // Should show drawer toggle button
    expect(screen.getByRole("button", { name: /new feature/i })).toBeInTheDocument();
    
    // Click to open drawer
    fireEvent.click(screen.getByRole("button", { name: /new feature/i }));
    
    await waitFor(() => {
      // Should show PR list
      mockPullRequests.forEach(pr => {
        expect(screen.getByText(new RegExp(`#${pr.number}`))).toBeInTheDocument();
      });
    });
  });

  it("shows PR list on desktop for non-treemap views", async () => {
    renderCharts({ selectedQuadrant: "new-feature" });
    
    // Switch to donut chart
    fireEvent.click(screen.getByRole("button", { name: /donut/i }));
    
    await waitFor(() => {
      // Should show PR list in grid layout on desktop
      mockPullRequests.forEach(pr => {
        expect(screen.getByText(new RegExp(`#${pr.number}`))).toBeInTheDocument();
      });
    });
  });

  it("handles mobile view correctly", async () => {
    // Set mobile viewport
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });
    window.dispatchEvent(new Event("resize"));
    
    renderCharts({ selectedQuadrant: "new-feature" });
    
    // Switch to donut chart
    fireEvent.click(screen.getByRole("button", { name: /donut/i }));
    
    await waitFor(() => {
      // Should have mobile-specific rendering
      expect(screen.getAllByTestId("pie-chart")[0]).toBeInTheDocument();
    });
  });

  it("handles treemap drill down and drill up", async () => {
    const { useHierarchicalDistribution } = vi.mocked(
      await import("@/hooks/use-hierarchical-distribution")
    );
    const mockDrillDown = vi.fn();
    const mockDrillUp = vi.fn();
    
    useHierarchicalDistribution.mockReturnValue({
      hierarchicalData: { name: "root", children: [] },
      currentView: "quadrant",
      selectedQuadrant: null,
      drillDown: mockDrillDown,
      drillUp: mockDrillUp,
    });
    
    renderCharts();
    
    // Click drill down
    fireEvent.click(screen.getByText("Drill Down"));
    expect(mockDrillDown).toHaveBeenCalledWith("new-feature");
    expect(mockOnSegmentClick).toHaveBeenCalledWith("new-feature");
    
    // Click drill up
    fireEvent.click(screen.getByText("Drill Up"));
    expect(mockDrillUp).toHaveBeenCalled();
  });

  it("handles node click in treemap", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    renderCharts();
    
    fireEvent.click(screen.getByText("Node Click"));
    expect(consoleSpy).toHaveBeenCalledWith("Contributor node clicked:", "contributor1");
    
    consoleSpy.mockRestore();
  });

  it("displays loading state for treemap when no hierarchical data", async () => {
    const { useHierarchicalDistribution } = vi.mocked(
      await import("@/hooks/use-hierarchical-distribution")
    );
    
    useHierarchicalDistribution.mockReturnValue({
      hierarchicalData: null,
      currentView: "quadrant",
      selectedQuadrant: null,
      drillDown: vi.fn(),
      drillUp: vi.fn(),
    });
    
    renderCharts();
    
    expect(screen.getByText("Loading treemap data...")).toBeInTheDocument();
  });

  it("limits PR display to 50 items in drawer", () => {
    const manyPRs = Array.from({ length: 60 }, (_, i) => 
      createMockPR(i + 1, 100, 50)
    );
    
    renderCharts({ 
      selectedQuadrant: "new-feature",
      filteredPRs: manyPRs 
    });
    
    // Open drawer
    fireEvent.click(screen.getByRole("button", { name: /new feature/i }));
    
    // Should show limit message
    expect(screen.getByText("Showing first 50 of 60 PRs")).toBeInTheDocument();
  });

  it("correctly identifies primary language from commits", () => {
    const prWithMultipleLanguages: PullRequest = {
      ...createMockPR(1, 100, 50),
      commits: [
        { language: "TypeScript", additions: 100, deletions: 50 },
        { language: "JavaScript", additions: 50, deletions: 25 },
        { language: "CSS", additions: 20, deletions: 10 },
      ],
    };
    
    renderCharts({ 
      selectedQuadrant: "new-feature",
      filteredPRs: [prWithMultipleLanguages] 
    });
    
    // Open drawer
    fireEvent.click(screen.getByRole("button", { name: /new feature/i }));
    
    // TypeScript should be identified as primary language (most changes)
    const languageIndicator = screen.getByTitle("TypeScript");
    expect(languageIndicator).toBeInTheDocument();
    expect(languageIndicator).toHaveStyle({ backgroundColor: "#2b7489" });
  });
});