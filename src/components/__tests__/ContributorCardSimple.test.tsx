import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { ContributorCardSimple } from "../features/contributor/contributor-card-simple";
import type { MonthlyContributor } from "../../lib/types";

describe("ContributorCardSimple", () => {
  const mockContributor: MonthlyContributor = {
    login: "testuser",
    avatar_url: "https://example.com/avatar.jpg",
    activity: {
      pullRequests: 15,
      reviews: 10,
      comments: 25,
      totalScore: 50,
      firstContributionDate: "2024-01-01",
    },
    rank: 1,
    isWinner: true,
  };

  it("renders contributor information correctly", () => {
    render(<ContributorCardSimple contributor={mockContributor} />);

    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("Score: 50")).toBeInTheDocument();
    
    // Check that the main card structure is rendered
    expect(screen.getByRole("listitem")).toBeInTheDocument();
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
  });

  it("displays winner badge for winner", () => {
    render(<ContributorCardSimple contributor={mockContributor} isWinner={true} />);

    expect(screen.getByTestId("trophy-icon")).toBeInTheDocument();
    expect(screen.getByLabelText("Winner")).toBeInTheDocument();
  });

  it("displays rank when showRank is true", () => {
    render(<ContributorCardSimple contributor={mockContributor} showRank={true} />);

    expect(screen.getByTestId("badge")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveTextContent("1");
  });

  it("hides rank when showRank is false", () => {
    render(<ContributorCardSimple contributor={mockContributor} showRank={false} />);

    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("renders avatar with correct fallback", () => {
    render(<ContributorCardSimple contributor={mockContributor} />);

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("title", "testuser");
    expect(avatar).toHaveTextContent("T"); // Fallback for "testuser"
  });

  it("handles minimal contributor data", () => {
    const minimalContributor: MonthlyContributor = {
      login: "minimal",
      avatar_url: "https://example.com/minimal.jpg",
      activity: {
        pullRequests: 5,
        reviews: 2,
        comments: 3,
        totalScore: 10,
        firstContributionDate: "2024-01-15",
      },
      rank: 5,
    };

    render(<ContributorCardSimple contributor={minimalContributor} />);

    expect(screen.getByText("minimal")).toBeInTheDocument();
    expect(screen.getByText("Score: 10")).toBeInTheDocument();
    
    // Check activity items more specifically
    const activitySection = screen.getByRole("listitem").querySelector('.text-xs.text-muted-foreground');
    expect(activitySection).toBeInTheDocument();
    
    // Verify the basic structure is rendered
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
  });

  it("displays activity breakdown correctly", () => {
    render(<ContributorCardSimple contributor={mockContributor} />);

    // Check overall score is displayed
    expect(screen.getByText("Score: 50")).toBeInTheDocument();
    
    // Check that activity section exists - winner case uses "article" role
    const activitySection = screen.getByRole("listitem").querySelector('.text-xs.text-muted-foreground');
    expect(activitySection).toBeInTheDocument();
    
    // Check that tooltip content includes activity breakdown
    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent).toHaveTextContent("testuser's Activity");
    expect(tooltipContent).toHaveTextContent("Pull Requests");
    expect(tooltipContent).toHaveTextContent("Reviews");
    expect(tooltipContent).toHaveTextContent("Comments");
  });

  it("renders hover card wrapper", () => {
    render(<ContributorCardSimple contributor={mockContributor} />);

    expect(screen.getByTestId("hover-card")).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(<ContributorCardSimple contributor={mockContributor} isWinner={true} />);

    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("aria-label", "testuser - Winner, 50 points");
    expect(card).toHaveAttribute("tabIndex", "0");
  });

  it("applies correct styling classes for winner", () => {
    const { container } = render(
      <ContributorCardSimple contributor={mockContributor} isWinner={true} />
    );

    const card = container.querySelector('[role="article"]');
    expect(card).toHaveClass("ring-2", "ring-yellow-500");
  });

  it("renders tooltip with activity breakdown", () => {
    render(<ContributorCardSimple contributor={mockContributor} />);

    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toBeInTheDocument();
    
    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent).toBeInTheDocument();
    expect(tooltipContent).toHaveTextContent("testuser's Activity");
    expect(tooltipContent).toHaveTextContent("15 Pull Requests");
    expect(tooltipContent).toHaveTextContent("10 Reviews");
    expect(tooltipContent).toHaveTextContent("25 Comments");
  });

  it("applies custom className", () => {
    const { container } = render(
      <ContributorCardSimple contributor={mockContributor} className="custom-class" />
    );

    const card = container.querySelector('[role="listitem"]');
    expect(card).toHaveClass("custom-class");
  });

  it("uses custom icon renderer when provided", () => {
    const customIconRenderer = (name: string) => <div data-testid={`custom-${name}`}>{name}</div>;

    render(
      <ContributorCardSimple 
        contributor={mockContributor} 
        renderIcon={customIconRenderer}
      />
    );

    // Check that custom icons are rendered - use getAllByTestId since they appear in both card and tooltip
    expect(screen.getAllByTestId("custom-GitPullRequest")).toHaveLength(2);
    expect(screen.getAllByTestId("custom-GitPullRequestDraft")).toHaveLength(2);
    expect(screen.getAllByTestId("custom-MessageSquare")).toHaveLength(2);
  });

  it("handles zero activity gracefully", () => {
    const zeroActivityContributor = {
      ...mockContributor,
      activity: {
        pullRequests: 0,
        reviews: 0,
        comments: 0,
        totalScore: 0,
        firstContributionDate: "2024-01-01",
      },
    };

    render(<ContributorCardSimple contributor={zeroActivityContributor} />);

    expect(screen.getByText("Score: 0")).toBeInTheDocument();
    
    // Check that basic structure is still rendered even with zero activity
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
  });
});