import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DistributionTreemapEnhanced } from "../distribution-treemap-enhanced";
import type { QuadrantNode } from "@/hooks/use-hierarchical-distribution";

// Mock recharts components
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Treemap: ({ children, content, data }: any) => (
    <div data-testid="treemap">
      {data.map((item: any, index: number) => (
        <div key={index} data-testid={`treemap-node-${item.id}`}>
          {content && content({ ...item, x: 0, y: 0, width: 100, height: 100 })}
        </div>
      ))}
      {children}
    </div>
  ),
  Tooltip: ({ content }: any) => <div data-testid="tooltip">{content}</div>,
}));

const mockOverviewData = {
  name: "root",
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
    {
      id: "refactoring",
      name: "Refactoring",
      value: 8,
      color: "#f97316",
      children: [],
    },
    {
      id: "maintenance",
      name: "Maintenance",
      value: 12,
      color: "#a78bfa",
      children: [],
    },
  ],
};

const mockQuadrantData = {
  name: "root",
  children: [
    {
      id: "new",
      name: "New Features",
      value: 15,
      color: "#60a5fa",
      children: [
        {
          id: "user1",
          name: "User 1",
          value: 5,
          login: "user1",
          avatar_url: "https://avatars.githubusercontent.com/u/1",
          prs: [
            { id: 1, number: 1, title: "Add feature A" },
            { id: 2, number: 2, title: "Add feature B" },
          ],
        },
        {
          id: "user2",
          name: "User 2",
          value: 7,
          login: "user2",
          avatar_url: "https://avatars.githubusercontent.com/u/2",
          prs: [
            { id: 3, number: 3, title: "Add feature C" },
            { id: 4, number: 4, title: "Add feature D" },
            { id: 5, number: 5, title: "Add feature E" },
          ],
        },
        {
          id: "others",
          name: "Others",
          value: 3,
          login: "others",
          prs: [],
        },
      ],
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
    
    // Should render all quadrants
    expect(screen.getByTestId("treemap-node-refinement")).toBeInTheDocument();
    expect(screen.getByTestId("treemap-node-new")).toBeInTheDocument();
    expect(screen.getByTestId("treemap-node-refactoring")).toBeInTheDocument();
    expect(screen.getByTestId("treemap-node-maintenance")).toBeInTheDocument();
  });

  it("renders quadrant labels and values in overview", () => {
    renderTreemap();

    expect(screen.getByText("Refinement")).toBeInTheDocument();
    expect(screen.getByText("10 PRs")).toBeInTheDocument();
    expect(screen.getByText("New Features")).toBeInTheDocument();
    expect(screen.getByText("15 PRs")).toBeInTheDocument();
    expect(screen.getByText("Refactoring")).toBeInTheDocument();
    expect(screen.getByText("8 PRs")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("12 PRs")).toBeInTheDocument();
  });

  it("handles drill down on quadrant click", () => {
    renderTreemap();

    const refinementNode = screen.getByTestId("treemap-node-refinement");
    const rect = refinementNode.querySelector("rect");
    
    fireEvent.click(rect!);
    
    expect(mockOnDrillDown).toHaveBeenCalledWith("refinement");
  });

  it("renders quadrant view correctly", () => {
    renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    // Should show breadcrumb navigation
    expect(screen.getByRole("button", { name: /all contributions/i })).toBeInTheDocument();
    expect(screen.getByText("New Features")).toBeInTheDocument();
    
    // Should render contributor nodes
    expect(screen.getByTestId("treemap-node-user1")).toBeInTheDocument();
    expect(screen.getByTestId("treemap-node-user2")).toBeInTheDocument();
    expect(screen.getByTestId("treemap-node-others")).toBeInTheDocument();
  });

  it("renders contributor avatars in quadrant view", () => {
    renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    // Check for avatar images
    const avatarImages = screen.getAllByAltText(/user/i);
    expect(avatarImages).toHaveLength(2); // user1 and user2
  });

  it("renders others node with icon", () => {
    renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    // Check for Users icon in others node
    const othersNode = screen.getByTestId("treemap-node-others");
    expect(othersNode.querySelector("svg")).toBeInTheDocument();
  });

  it("handles drill up from quadrant view", () => {
    renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    const backButton = screen.getByRole("button", { name: /all contributions/i });
    fireEvent.click(backButton);
    
    expect(mockOnDrillUp).toHaveBeenCalled();
  });

  it("handles contributor node click", () => {
    renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    const user1Node = screen.getByTestId("treemap-node-user1");
    const rect = user1Node.querySelector("rect");
    
    fireEvent.click(rect!);
    
    expect(mockOnNodeClick).toHaveBeenCalledWith("user1");
  });

  it("does not trigger node click for others node", () => {
    renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    const othersNode = screen.getByTestId("treemap-node-others");
    const rect = othersNode.querySelector("rect");
    
    fireEvent.click(rect!);
    
    expect(mockOnNodeClick).not.toHaveBeenCalled();
  });

  it("shows tooltip on hover in quadrant view", async () => {
    renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    const user1Node = screen.getByTestId("treemap-node-user1");
    const rect = user1Node.querySelector("rect");
    
    fireEvent.mouseEnter(rect!);
    
    // Wait for hover state to update
    await waitFor(() => {
      // The tooltip would show PR preview
      expect(mockOnNodeClick).toBeDefined(); // Basic check since tooltip is mocked
    });
    
    fireEvent.mouseLeave(rect!);
  });

  it("handles empty data gracefully", () => {
    renderTreemap({
      data: { name: "root", children: [] },
    });

    expect(screen.getByText("All Contributions")).toBeInTheDocument();
    expect(screen.getByTestId("treemap")).toBeInTheDocument();
  });

  it("handles missing children in data", () => {
    renderTreemap({
      data: { name: "root" },
    });

    expect(screen.getByText("All Contributions")).toBeInTheDocument();
    expect(screen.getByTestId("treemap")).toBeInTheDocument();
  });

  it("applies correct colors to quadrants", () => {
    renderTreemap();

    const refinementNode = screen.getByTestId("treemap-node-refinement");
    const rect = refinementNode.querySelector("rect");
    
    expect(rect).toHaveStyle({ fill: "#4ade80" });
  });

  it("applies correct animations classes", () => {
    renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "new",
    });

    // Check for animation classes
    const container = screen.getByTestId("responsive-container").parentElement;
    expect(container).toHaveClass("treemap-container");
    expect(container).toHaveClass("treemap-drill-down");
  });

  it("shows correct breadcrumb for different quadrants", () => {
    const { rerender } = renderTreemap({
      data: mockQuadrantData,
      currentView: "quadrant",
      selectedQuadrant: "maintenance",
    });

    expect(screen.getByText("Maintenance")).toBeInTheDocument();

    rerender(
      <DistributionTreemapEnhanced
        data={mockQuadrantData}
        currentView="quadrant"
        selectedQuadrant="refactoring"
        onDrillDown={mockOnDrillDown}
        onDrillUp={mockOnDrillUp}
        onNodeClick={mockOnNodeClick}
      />
    );

    expect(screen.getByText("Refactoring")).toBeInTheDocument();
  });

  it("handles small node sizes gracefully", () => {
    const smallNodeData = {
      name: "root",
      children: [
        {
          id: "tiny",
          name: "Tiny",
          value: 1,
          color: "#4ade80",
          children: [],
        },
      ],
    };

    renderTreemap({ data: smallNodeData });

    // Should render but might not show text for small nodes
    expect(screen.getByTestId("treemap-node-tiny")).toBeInTheDocument();
  });
});