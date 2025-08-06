/**
 * Tests for MinimalActivityDisplay component
 * Isolated test with proper mock management to prevent flaky behavior
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";

// Mock all UI components before any imports
vi.mock("@/components/ui/card", () => {
  const React = require("react");
  return {
    Card: ({ children, className }: any) => 
      React.createElement('div', { className: `card ${className || ''}`, 'data-testid': 'card' }, children),
    CardContent: ({ children, className }: any) => 
      React.createElement('div', { className: `card-content ${className || ''}`, 'data-testid': 'card-content' }, children),
    CardHeader: ({ children, className }: any) => 
      React.createElement('div', { className: `card-header ${className || ''}`, 'data-testid': 'card-header' }, children),
    CardTitle: ({ children, className }: any) => 
      React.createElement('h3', { className: `card-title ${className || ''}`, 'data-testid': 'card-title' }, children),
  };
});

vi.mock("@/components/ui/badge", () => {
  const React = require("react");
  return {
    Badge: ({ children, className }: any) => 
      React.createElement('span', { className: `badge ${className || ''}`, 'data-testid': 'badge' }, children),
  };
});

vi.mock("lucide-react", () => {
  const React = require("react");
  return {
    TrendingUp: (props: any) => React.createElement('svg', { 
      ...props, 
      'data-testid': 'trending-up-icon',
      'data-icon': 'trending-up'
    }),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

// Import the component AFTER mocks are established
import { MinimalActivityDisplay } from "../features/contributor/contributor-empty-state";

describe("MinimalActivityDisplay - Isolated Component Tests", () => {
  const mockContributors = [
    {
      login: "user1",
      avatar_url: "https://example.com/avatar1.jpg",
      activity: {
        pullRequests: 5,
        reviews: 3,
        comments: 2,
        totalScore: 10,
      },
      rank: 1,
    },
    {
      login: "user2",
      avatar_url: "https://example.com/avatar2.jpg",
      activity: {
        pullRequests: 3,
        reviews: 2,
        comments: 1,
        totalScore: 6,
      },
      rank: 2,
    },
  ];

  beforeEach(() => {
    // Ensure clean state for each test
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up after each test to prevent pollution
    vi.clearAllMocks();
  });

  it("renders minimal activity display with correct header and stats", () => {
    const { container } = render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="January"
        year={2024}
      />
    );

    // Verify component rendered
    expect(container.innerHTML).not.toBe('');
    
    // Check for header content
    expect(screen.getByText(/Early Activity - January 2024/)).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    
    // Check for stats summary
    expect(screen.getByText(/2 contributors • 16 total points/)).toBeInTheDocument();
    
    // Verify card structure is present
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('card-header')).toBeInTheDocument();
    expect(screen.getByTestId('card-content')).toBeInTheDocument();
  });

  it("displays individual contributor information correctly", () => {
    const { container } = render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="January"
        year={2024}
      />
    );

    // Verify component rendered
    expect(container.innerHTML).not.toBe('');
    
    // Check first contributor
    expect(screen.getByText("user1")).toBeInTheDocument();
    expect(screen.getByText("10 pts")).toBeInTheDocument();
    
    // Check second contributor
    expect(screen.getByText("user2")).toBeInTheDocument();
    expect(screen.getByText("6 pts")).toBeInTheDocument();
  });

  it("handles single contributor scenario properly", () => {
    const { container } = render(
      <MinimalActivityDisplay
        contributors={[mockContributors[0]]}
        month="February"
        year={2024}
      />
    );

    // Verify component rendered
    expect(container.innerHTML).not.toBe('');
    
    // Should show singular contributor text
    expect(screen.getByText(/1 contributor • 10 total points/)).toBeInTheDocument();
    expect(screen.getByText(/Early Activity - February 2024/)).toBeInTheDocument();
    
    // Should only show one contributor
    expect(screen.getByText("user1")).toBeInTheDocument();
    expect(screen.queryByText("user2")).not.toBeInTheDocument();
  });

  it("applies custom className without affecting functionality", () => {
    const customClass = "my-custom-minimal-class";
    const { container } = render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="March"
        year={2024}
        className={customClass}
      />
    );

    // Verify component rendered
    expect(container.innerHTML).not.toBe('');
    
    // Custom class should be applied
    expect(container.querySelector(`.${customClass}`)).toBeInTheDocument();
    
    // Functionality should still work
    expect(screen.getByText(/Early Activity - March 2024/)).toBeInTheDocument();
    expect(screen.getByText(/2 contributors • 16 total points/)).toBeInTheDocument();
  });

  it("handles empty contributors array gracefully", () => {
    const { container } = render(
      <MinimalActivityDisplay
        contributors={[]}
        month="April"
        year={2024}
      />
    );

    // Verify component rendered (should handle empty state)
    expect(container.innerHTML).not.toBe('');
    
    // Should show empty state messaging
    expect(screen.getByText(/Early Activity - April 2024/)).toBeInTheDocument();
    expect(screen.getByText(/0 contributors • 0 total points/)).toBeInTheDocument();
  });

  it("calculates total points correctly across contributors", () => {
    const contributorsWithDifferentScores = [
      { ...mockContributors[0], activity: { ...mockContributors[0].activity, totalScore: 15 } },
      { ...mockContributors[1], activity: { ...mockContributors[1].activity, totalScore: 25 } },
    ];

    const { container } = render(
      <MinimalActivityDisplay
        contributors={contributorsWithDifferentScores}
        month="May"
        year={2024}
      />
    );

    // Verify component rendered
    expect(container.innerHTML).not.toBe('');
    
    // Should calculate total correctly (15 + 25 = 40)
    expect(screen.getByText(/2 contributors • 40 total points/)).toBeInTheDocument();
    expect(screen.getByText("15 pts")).toBeInTheDocument();
    expect(screen.getByText("25 pts")).toBeInTheDocument();
  });
});