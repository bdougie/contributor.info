import { render, screen } from "@testing-library/react";
import { BrowserRouter as Router } from "react-router-dom";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { ContributorOfTheMonth, ContributorCard, ContributorEmptyState } from "../features/contributor";
import { ContributorRanking, MonthlyContributor } from "@/lib/types";
import { TestRepoStatsProvider } from "./test-utils";

describe("Contributor Feature Integration", () => {
  const mockContributor: MonthlyContributor = {
    login: "test-user",
    avatar_url: "https://example.com/avatar.jpg",
    activity: {
      pullRequests: 3,
      reviews: 5,
      comments: 7,
      totalScore: 39, // (3 * 1) + (5 * 3) + (7 * 3) = 3 + 15 + 21 = 39
      firstContributionDate: "2024-01-15T10:30:00Z",
    },
    rank: 1,
    isWinner: true,
  };

  const mockRanking: ContributorRanking = {
    month: "January",
    year: 2024,
    contributors: [mockContributor],
    winner: mockContributor,
    phase: "winner_announcement",
  };

  it("renders complete contributor of the month feature", () => {
    render(
      <Router>
        <ContributorOfTheMonth ranking={mockRanking} />
      </Router>
    );

    // Check main component
    expect(screen.getByText("Contributor of the Month")).toBeInTheDocument();
    expect(screen.getByText("Celebrating January 2024's top contributor")).toBeInTheDocument();

    // Check contributor details
    expect(screen.getByText("test-user")).toBeInTheDocument();
    expect(screen.getByText("Score: 39")).toBeInTheDocument(); // Score

    // Check winner badge
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });

  it("renders individual contributor card correctly", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorCard contributor={mockContributor} />
      </TestRepoStatsProvider>
    );

    expect(screen.getByText("test-user")).toBeInTheDocument();
    expect(screen.getByText("Score: 39")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // PRs
    expect(screen.getByText("5")).toBeInTheDocument(); // Reviews
    expect(screen.getByText("7")).toBeInTheDocument(); // Comments
  });

  it("handles error states gracefully", () => {
    render(<ContributorEmptyState type="loading_error" message="Test error" />);

    expect(
      screen.getByText("Unable to Load Contributor Data")
    ).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("maintains accessibility standards", () => {
    render(
      <Router>
        <ContributorOfTheMonth ranking={mockRanking} />
      </Router>
    );

    const mainRegion = screen.getByRole("region", {
      name: /contributor of the month/i,
    });
    expect(mainRegion).toBeInTheDocument();

    const winnerCard = screen.getByRole("article");
    expect(winnerCard).toBeInTheDocument();
    expect(winnerCard).toHaveAttribute("aria-label");
    expect(winnerCard).toHaveAttribute("tabIndex", "0");
  });

  it("handles responsive design classes", () => {
    // Create multiple contributors to ensure grid is rendered (need at least 3 to avoid minimal activity display)
    const secondContributor: MonthlyContributor = {
      ...mockContributor,
      login: "user2",
      rank: 2,
      activity: { ...mockContributor.activity, totalScore: 25 },
    };
    
    const thirdContributor: MonthlyContributor = {
      ...mockContributor,
      login: "user3",
      rank: 3,
      activity: { ...mockContributor.activity, totalScore: 15 },
    };
    
    // Test with leaderboard phase to ensure grid is rendered
    const leaderboardRanking: ContributorRanking = {
      ...mockRanking,
      phase: "running_leaderboard",
      contributors: [mockContributor, secondContributor, thirdContributor],
      winner: undefined,
    };
    
    const { container } = render(
      <Router>
        <ContributorOfTheMonth ranking={leaderboardRanking} />
      </Router>
    );

    // Check that grid layout classes are present
    const gridContainer = container.querySelector(".grid");
    expect(gridContainer).toBeInTheDocument();
  });
});
