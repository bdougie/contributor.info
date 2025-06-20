import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DistributionTreemapEnhanced } from "../distribution-treemap-enhanced";

// Mock recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Treemap: ({ children }: any) => (
    <div data-testid="treemap">
      {children}
    </div>
  ),
  Tooltip: () => <div data-testid="tooltip" />,
}));

const mockOverviewData = {
  name: "Distribution",
  children: [
    {
      id: "refinement",
      name: "Refinement",
      value: 10,
      color: "#4ade80",
      children: [],
    },
    {
      id: "new",
      name: "New Features",
      value: 15,
      color: "#60a5fa",
      children: [],
    },
  ],
};

describe("DistributionTreemapEnhanced", () => {
  const mockOnDrillDown = vi.fn();
  const mockOnDrillUp = vi.fn();
  const mockOnNodeClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderTreemap = (props = {}) => {
    return render(
      <DistributionTreemapEnhanced
        data={mockOverviewData}
        currentView="overview"
        selectedQuadrant={null}
        onDrillDown={mockOnDrillDown}
        onDrillUp={mockOnDrillUp}
        onNodeClick={mockOnNodeClick}
        {...props}
      />
    );
  };

  it("renders overview correctly", () => {
    renderTreemap();

    expect(screen.getByText("All Contributions")).toBeInTheDocument();
    expect(screen.getByTestId("treemap")).toBeInTheDocument();
  });

  it("renders quadrant view correctly", () => {
    renderTreemap({
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    // Should show breadcrumb navigation
    expect(screen.getByRole("button", { name: /all contributions/i })).toBeInTheDocument();
    expect(screen.getByText("New Features")).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    renderTreemap({
      data: { name: "root", children: [] },
    });

    expect(screen.getByText("All Contributions")).toBeInTheDocument();
    expect(screen.getByTestId("treemap")).toBeInTheDocument();
  });
});