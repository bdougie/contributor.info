import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

// Mock the UI components inline to avoid complex module mocking
vi.mock("@/components/ui/card", () => {
  const React = require("react");
  return {
    Card: ({ children, role, className, ...props }: any) => 
      React.createElement('div', { role, className, ...props }, children),
    CardContent: ({ children }: any) => 
      React.createElement('div', null, children),
    CardHeader: ({ children }: any) => 
      React.createElement('div', null, children),
    CardTitle: ({ children }: any) => 
      React.createElement('h3', null, children),
  };
});

vi.mock("@/components/ui/badge", () => {
  const React = require("react");
  return {
    Badge: ({ children }: any) => 
      React.createElement('span', null, children),
  };
});

vi.mock("lucide-react", () => {
  const React = require("react");
  return {
    Trophy: () => React.createElement('svg', { 'data-testid': 'trophy-icon' }),
    Users: () => React.createElement('svg', { 'data-testid': 'users-icon' }),
    Calendar: () => React.createElement('svg', { 'data-testid': 'calendar-icon' }),
    TrendingUp: () => React.createElement('svg', { 'data-testid': 'trending-icon' }),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

import {
  ContributorEmptyState,
  MinimalActivityDisplay,
} from "../features/contributor/contributor-empty-state";

describe("ContributorEmptyState", () => {
  it("renders no_data state correctly", () => {
    render(<ContributorEmptyState type="no_data" />);

    // Check for the main title
    expect(
      screen.getByText("No Contributor Data Available")
    ).toBeInTheDocument();
    
    // Check for the description
    expect(
      screen.getByText(
        "We couldn't find any contributor data for this repository."
      )
    ).toBeInTheDocument();
    
    // Check for the suggestion text
    expect(
      screen.getByText(
        "Make sure the repository has some activity and try again."
      )
    ).toBeInTheDocument();
    
    // Check for the tip badge
    expect(screen.getByText(/Tip/)).toBeInTheDocument();
  });

  it("renders no_activity state correctly", () => {
    render(<ContributorEmptyState type="no_activity" />);

    expect(screen.getByText("No Activity This Month")).toBeInTheDocument();
    expect(
      screen.getByText("No contributor activity found for the current period.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Check back later as contributors start making contributions this month."
      )
    ).toBeInTheDocument();
  });

  it("renders minimal_activity state correctly", () => {
    render(<ContributorEmptyState type="minimal_activity" />);

    expect(screen.getByText("Limited Activity")).toBeInTheDocument();
    expect(
      screen.getByText("There's been minimal contributor activity this month.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The leaderboard will be more meaningful as more contributors join."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Note/)).toBeInTheDocument();
  });

  it("renders loading_error state correctly", () => {
    render(<ContributorEmptyState type="loading_error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Unable to Load Contributor Data")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We encountered an error while loading contributor information."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Please try refreshing the page or check your network connection."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Error/)).toBeInTheDocument();
  });

  it("renders custom message and suggestion", () => {
    const customMessage = "Custom error message";
    const customSuggestion = "Custom suggestion text";

    render(
      <ContributorEmptyState
        type="no_data"
        message={customMessage}
        suggestion={customSuggestion}
      />
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.getByText(customSuggestion)).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<ContributorEmptyState type="no_data" className="custom-class" />);

    const card = screen.getByRole("status");
    expect(card).toHaveClass("custom-class");
  });

  it("has correct accessibility attributes for different states", () => {
    const { rerender } = render(<ContributorEmptyState type="no_data" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

    rerender(<ContributorEmptyState type="loading_error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("renders icons for each state", () => {
    const { rerender } = render(<ContributorEmptyState type="no_data" />);
    expect(screen.getByTestId("users-icon")).toBeInTheDocument();

    rerender(<ContributorEmptyState type="no_activity" />);
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();

    rerender(<ContributorEmptyState type="minimal_activity" />);
    expect(screen.getByTestId("trending-icon")).toBeInTheDocument();

    rerender(<ContributorEmptyState type="loading_error" />);
    // Trophy icon appears in both the card header and the empty state
    const trophyIcons = screen.getAllByTestId("trophy-icon");
    expect(trophyIcons.length).toBeGreaterThan(0);
  });
});

describe("MinimalActivityDisplay", () => {
  const mockContributors = [
    {
      login: "user1",
      avatar_url: "https://example.com/avatar1.jpg",
      activity: {
        pullRequests: 2,
        reviews: 1,
        comments: 3,
        totalScore: 8,
      },
      rank: 1,
    },
    {
      login: "user2",
      avatar_url: "https://example.com/avatar2.jpg",
      activity: {
        pullRequests: 1,
        reviews: 2,
        comments: 1,
        totalScore: 10,
      },
      rank: 2,
    },
    {
      login: "user3",
      avatar_url: "https://example.com/avatar3.jpg",
      activity: {
        pullRequests: 0,
        reviews: 1,
        comments: 2,
        totalScore: 9,
      },
      rank: 3,
    },
  ];

  it("renders minimal activity display correctly", () => {
    render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="March"
        year={2024}
      />
    );

    expect(screen.getByText("Early Activity - March 2024")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(
      screen.getByText("3 contributors • 27 total points")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Early Month Activity Detected")
    ).toBeInTheDocument();
  });

  it("handles singular contributor count correctly", () => {
    render(
      <MinimalActivityDisplay
        contributors={[mockContributors[0]]}
        month="April"
        year={2024}
      />
    );

    expect(
      screen.getByText("1 contributor • 8 total points")
    ).toBeInTheDocument();
  });

  it("shows top 3 contributors only", () => {
    const manyContributors = Array.from({ length: 5 }, (_, i) => ({
      login: `user${i + 1}`,
      avatar_url: `https://example.com/avatar${i + 1}.jpg`,
      activity: {
        pullRequests: 1,
        reviews: 1,
        comments: 1,
        totalScore: 5,
      },
      rank: i + 1,
    }));

    render(
      <MinimalActivityDisplay
        contributors={manyContributors}
        month="May"
        year={2024}
      />
    );

    expect(screen.getByText("user1")).toBeInTheDocument();
    expect(screen.getByText("user2")).toBeInTheDocument();
    expect(screen.getByText("user3")).toBeInTheDocument();
    expect(screen.queryByText("user4")).not.toBeInTheDocument();
    expect(screen.queryByText("user5")).not.toBeInTheDocument();
  });

  it("renders contributor avatars as initials", () => {
    render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="March"
        year={2024}
      />
    );

    // Check for initial letters
    const avatars = screen.getAllByText(/^U$/);
    expect(avatars.length).toBeGreaterThan(0);
  });

  it("displays correct point values", () => {
    render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="March"
        year={2024}
      />
    );

    expect(screen.getByText("8 pts")).toBeInTheDocument();
    expect(screen.getByText("10 pts")).toBeInTheDocument();
    expect(screen.getByText("9 pts")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="March"
        year={2024}
        className="custom-class"
      />
    );

    const title = screen.getByText("Early Activity - March 2024");
    const card = title.closest('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it("handles empty contributors list", () => {
    render(
      <MinimalActivityDisplay contributors={[]} month="June" year={2024} />
    );

    expect(
      screen.getByText("0 contributors • 0 total points")
    ).toBeInTheDocument();
    expect(screen.queryByText("Current Activity")).not.toBeInTheDocument();
  });

  it("calculates total activity correctly", () => {
    const customContributors = [
      {
        login: "test1",
        avatar_url: "https://example.com/avatar.jpg",
        activity: {
          pullRequests: 5,
          reviews: 3,
          comments: 2,
          totalScore: 50,
        },
        rank: 1,
      },
      {
        login: "test2",
        avatar_url: "https://example.com/avatar.jpg",
        activity: {
          pullRequests: 2,
          reviews: 1,
          comments: 4,
          totalScore: 25,
        },
        rank: 2,
      },
    ];

    render(
      <MinimalActivityDisplay
        contributors={customContributors}
        month="July"
        year={2024}
      />
    );

    expect(
      screen.getByText("2 contributors • 75 total points")
    ).toBeInTheDocument();
  });
});