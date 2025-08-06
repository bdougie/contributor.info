import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";

// Import the simple version for testing - no mocks needed!
import { ContributorEmptyStateSimple } from "../features/contributor/contributor-empty-state-simple";

// For MinimalActivityDisplay, we still need mocks for now
vi.mock("@/components/ui/card", () => {
  const React = require("react");
  return {
    Card: ({ children, className }: any) => 
      React.createElement('div', { className }, children),
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
    TrendingUp: () => React.createElement('svg', { 'data-testid': 'trending-icon' }),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

import { MinimalActivityDisplay } from "../features/contributor/contributor-empty-state";

describe("ContributorEmptyState", () => {
  it("renders no_data state correctly", () => {
    render(<ContributorEmptyStateSimple type="no_data" />);

    expect(screen.getByText("No Contributor Data Available")).toBeInTheDocument();
    expect(
      screen.getByText("We couldn't find any contributor data for this repository.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Make sure the repository has some activity and try again.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Tip/)).toBeInTheDocument();
  });

  it("renders no_activity state correctly", () => {
    render(<ContributorEmptyStateSimple type="no_activity" />);

    expect(screen.getByText("No Activity This Month")).toBeInTheDocument();
    expect(
      screen.getByText("No contributor activity found for the current period.")
    ).toBeInTheDocument();
  });

  it("renders minimal_activity state correctly", () => {
    render(<ContributorEmptyStateSimple type="minimal_activity" />);

    expect(screen.getByText("Limited Activity")).toBeInTheDocument();
    expect(
      screen.getByText("There's been minimal contributor activity this month.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Note/)).toBeInTheDocument();
  });

  it("renders loading_error state correctly", () => {
    render(<ContributorEmptyStateSimple type="loading_error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Unable to Load Contributor Data")).toBeInTheDocument();
    expect(screen.getByText(/Error/)).toBeInTheDocument();
  });

  it("renders custom message and suggestion", () => {
    const customMessage = "Custom error message";
    const customSuggestion = "Custom suggestion text";

    render(
      <ContributorEmptyStateSimple
        type="no_data"
        message={customMessage}
        suggestion={customSuggestion}
      />
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.getByText(customSuggestion)).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ContributorEmptyStateSimple type="no_data" className="custom-class" />
    );
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("has correct accessibility attributes for different states", () => {
    const { rerender } = render(<ContributorEmptyStateSimple type="no_data" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

    rerender(<ContributorEmptyStateSimple type="loading_error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("renders correct icon names for each state", () => {
    const { rerender } = render(<ContributorEmptyStateSimple type="no_data" />);
    expect(screen.getByText("users")).toBeInTheDocument();

    rerender(<ContributorEmptyStateSimple type="no_activity" />);
    expect(screen.getByText("calendar")).toBeInTheDocument();

    rerender(<ContributorEmptyStateSimple type="minimal_activity" />);
    expect(screen.getByText("trending-up")).toBeInTheDocument();

    rerender(<ContributorEmptyStateSimple type="loading_error" />);
    expect(screen.getByText("trophy")).toBeInTheDocument();
  });
});

describe("MinimalActivityDisplay", () => {
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

  it("renders minimal activity display correctly", () => {
    render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="January"
        year={2024}
      />
    );

    expect(screen.getByText(/Early Activity - January 2024/)).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText(/2 contributors • 16 total points/)).toBeInTheDocument();
  });

  it("displays top contributors", () => {
    render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="January"
        year={2024}
      />
    );

    expect(screen.getByText("user1")).toBeInTheDocument();
    expect(screen.getByText("10 pts")).toBeInTheDocument();
    expect(screen.getByText("user2")).toBeInTheDocument();
    expect(screen.getByText("6 pts")).toBeInTheDocument();
  });

  it("handles single contributor correctly", () => {
    render(
      <MinimalActivityDisplay
        contributors={[mockContributors[0]]}
        month="February"
        year={2024}
      />
    );

    expect(screen.getByText(/1 contributor • 10 total points/)).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <MinimalActivityDisplay
        contributors={mockContributors}
        month="March"
        year={2024}
        className="custom-minimal-class"
      />
    );

    expect(container.querySelector(".custom-minimal-class")).toBeInTheDocument();
  });
});