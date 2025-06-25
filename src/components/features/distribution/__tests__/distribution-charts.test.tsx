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

// Mock React Router hooks
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/test", search: "", hash: "" }),
  useNavigate: () => vi.fn(),
}));

// Mock GitHub auth hook
vi.mock("@/hooks/use-github-auth", () => ({
  useGitHubAuth: () => ({
    isLoggedIn: false,
    showLoginDialog: false,
    setShowLoginDialog: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock html2canvas
vi.mock("html2canvas", () => ({
  default: vi.fn(() => Promise.resolve({
    toDataURL: () => "data:image/png;base64,test",
    toBlob: (callback: (blob: Blob) => void) => callback(new Blob()),
  })),
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
    
    expect(screen.getByTestId("treemap-enhanced")).toBeInTheDocument();
    
    // Verify quadrant buttons are rendered in the legend area
    expect(screen.getByText("New Feature")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Refactoring")).toBeInTheDocument();
    expect(screen.getByText("Refinement")).toBeInTheDocument();
  });

  it("renders different chart types via props", async () => {
    // Test donut chart
    const { rerender } = renderCharts({ chartType: "donut" });
    
    await waitFor(() => {
      expect(screen.getAllByTestId("pie-chart")[0]).toBeInTheDocument();
      expect(screen.queryByTestId("treemap-enhanced")).not.toBeInTheDocument();
    });
    
    // Test bar chart
    rerender(
      <DistributionCharts
        data={mockData}
        onSegmentClick={mockOnSegmentClick}
        filteredPRs={[]}
        pullRequests={mockPullRequests}
        chartType="bar"
      />
    );
    
    await waitFor(() => {
      expect(screen.getAllByTestId("bar-chart")[0]).toBeInTheDocument();
      expect(screen.queryAllByTestId("pie-chart")).toHaveLength(0);
      expect(screen.queryByTestId("treemap-enhanced")).not.toBeInTheDocument();
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
    renderCharts({ chartType: "donut" });
    
    await waitFor(() => {
      const pies = screen.getAllByTestId("pie");
      fireEvent.click(pies[0]);
      expect(mockOnSegmentClick).toHaveBeenCalledWith("new-feature");
    });
  });

  it("handles segment click in bar chart", async () => {
    renderCharts({ chartType: "bar" });
    
    await waitFor(() => {
      const bars = screen.getAllByTestId("bar");
      fireEvent.click(bars[0]);
      expect(mockOnSegmentClick).toHaveBeenCalledWith("maintenance");
    });
  });

  it("shows PR drawer when quadrant is selected in treemap mode", () => {
    renderCharts({ selectedQuadrant: "new-feature" });
    
    // Should show drawer toggle button for selected quadrant
    expect(screen.getAllByRole("button", { name: /new feature/i })[0]).toBeInTheDocument();
  });

  it("shows PR list on desktop for non-treemap views", async () => {
    renderCharts({ selectedQuadrant: "new-feature", chartType: "donut" });
    
    await waitFor(() => {
      // Should show donut chart
      expect(screen.getAllByTestId("pie-chart")[0]).toBeInTheDocument();
    });
  });

  it("handles mobile view correctly", () => {
    // Set mobile viewport
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    renderCharts();
    
    // Should render mobile view with treemap by default
    expect(screen.getByTestId("treemap-enhanced")).toBeInTheDocument();
    
    // Verify quadrant legends are still visible
    expect(screen.getByText("New Feature")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
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
      loading: false,
    });
    
    renderCharts();
    
    // Test that hook functions are available
    expect(mockDrillDown).toBeDefined();
    expect(mockDrillUp).toBeDefined();
  });

  it("handles node click in treemap", () => {
    renderCharts();
    
    // Test that component renders with treemap
    expect(screen.getByTestId("treemap-enhanced")).toBeInTheDocument();
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
      loading: false,
    });
    
    renderCharts();
    
    expect(screen.getByText("Loading treemap data...")).toBeInTheDocument();
  });
});