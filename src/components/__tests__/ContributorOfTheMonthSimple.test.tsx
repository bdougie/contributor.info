import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { ContributorOfTheMonthSimple } from "../features/contributor/contributor-of-the-month-simple";
import type { ContributorRanking } from "../../lib/types";

describe("ContributorOfTheMonthSimple", () => {
  const mockWinnerRanking: ContributorRanking = {
    month: "January",
    year: 2024,
    contributors: [
      {
        login: "winner-user",
        avatar_url: "https://example.com/avatar1.jpg",
        activity: {
          pullRequests: 10,
          reviews: 15,
          comments: 20,
          totalScore: 115,
          firstContributionDate: "2024-01-01T10:00:00Z",
        },
        rank: 1,
        isWinner: true,
      },
      {
        login: "runner-up",
        avatar_url: "https://example.com/avatar2.jpg",
        activity: {
          pullRequests: 8,
          reviews: 10,
          comments: 15,
          totalScore: 83,
          firstContributionDate: "2024-01-05T14:30:00Z",
        },
        rank: 2,
      },
    ],
    winner: {
      login: "winner-user",
      avatar_url: "https://example.com/avatar1.jpg",
      activity: {
        pullRequests: 10,
        reviews: 15,
        comments: 20,
        totalScore: 115,
        firstContributionDate: "2024-01-01T10:00:00Z",
      },
      rank: 1,
      isWinner: true,
    },
    phase: "winner_announcement",
  };

  const mockLeaderboardRanking: ContributorRanking = {
    month: "February",
    year: 2024,
    contributors: [
      {
        login: "leader1",
        avatar_url: "https://example.com/avatar1.jpg",
        activity: {
          pullRequests: 8,
          reviews: 10,
          comments: 15,
          totalScore: 83,
          firstContributionDate: "2024-02-01T10:00:00Z",
        },
        rank: 1,
      },
      {
        login: "leader2",
        avatar_url: "https://example.com/avatar2.jpg",
        activity: {
          pullRequests: 6,
          reviews: 8,
          comments: 12,
          totalScore: 65,
          firstContributionDate: "2024-02-05T14:30:00Z",
        },
        rank: 2,
      },
      {
        login: "leader3",
        avatar_url: "https://example.com/avatar3.jpg",
        activity: {
          pullRequests: 4,
          reviews: 6,
          comments: 8,
          totalScore: 45,
          firstContributionDate: "2024-02-08T12:00:00Z",
        },
        rank: 3,
      },
    ],
    phase: "running_leaderboard",
  };

  it("renders loading state correctly", () => {
    render(<ContributorOfTheMonthSimple ranking={null} loading={true} />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("data-phase", "leaderboard");
    expect(skeleton).toHaveAttribute("data-count", "5");
  });

  it("renders error state correctly", () => {
    const errorMessage = "Failed to load contributor data";
    render(<ContributorOfTheMonthSimple ranking={null} error={errorMessage} />);

    const emptyState = screen.getByTestId("empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveAttribute("data-type", "loading_error");
    expect(emptyState).toHaveTextContent(errorMessage);
  });

  it("renders no activity state correctly", () => {
    render(<ContributorOfTheMonthSimple ranking={null} />);

    const emptyState = screen.getByTestId("empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveAttribute("data-type", "no_activity");
  });

  it("renders minimal activity state correctly", () => {
    const minimalRanking: ContributorRanking = {
      month: "March",
      year: 2024,
      contributors: [
        {
          login: "minimal-user",
          avatar_url: "https://example.com/avatar.jpg",
          activity: {
            pullRequests: 1,
            reviews: 0,
            comments: 2,
            totalScore: 3,
            firstContributionDate: "2024-03-01T10:00:00Z",
          },
          rank: 1,
        },
      ],
      phase: "running_leaderboard",
    };

    render(<ContributorOfTheMonthSimple ranking={minimalRanking} />);

    const minimalActivity = screen.getByTestId("minimal-activity");
    expect(minimalActivity).toBeInTheDocument();
    expect(minimalActivity).toHaveAttribute("data-month", "March");
    expect(minimalActivity).toHaveAttribute("data-year", "2024");
    expect(minimalActivity).toHaveAttribute("data-count", "1");
  });

  it("renders winner announcement phase correctly", () => {
    render(<ContributorOfTheMonthSimple ranking={mockWinnerRanking} />);

    // Check main structure
    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();

    // Check title and description
    expect(screen.getByTestId("card-title")).toHaveTextContent("Contributor of the Month");
    expect(screen.getByTestId("card-description")).toHaveTextContent(
      "Celebrating January 2024's top contributor"
    );

    // Check badge
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Winner");
    expect(badge).toHaveAttribute("data-variant", "default");

    // Check trophy icon
    expect(screen.getByTestId("icon-Trophy")).toBeInTheDocument();

    // Check winner display
    expect(screen.getByText("January 2024 Winner")).toBeInTheDocument();

    // Check winner contributor card - find the one with data-winner="true"
    const allCards = screen.getAllByTestId("contributor-card");
    const winnerCard = allCards.find(card => card.getAttribute("data-winner") === "true");
    expect(winnerCard).toBeTruthy();
    expect(winnerCard).toHaveAttribute("data-login", "winner-user");
    expect(winnerCard).toHaveAttribute("data-winner", "true");
    expect(winnerCard).toHaveAttribute("data-show-rank", "false");

    // Check runners-up section
    expect(screen.getByText("Top Contributors")).toBeInTheDocument();
    expect(screen.getByText("1 runners-up")).toBeInTheDocument();
  });

  it("renders running leaderboard phase correctly", () => {
    render(<ContributorOfTheMonthSimple ranking={mockLeaderboardRanking} />);

    // Check main structure
    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();

    // Check title and description
    expect(screen.getByTestId("card-title")).toHaveTextContent("Monthly Leaderboard");
    expect(screen.getByTestId("card-description")).toHaveTextContent(
      "Top contributors for February 2024"
    );

    // Check badge
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Current");
    expect(badge).toHaveAttribute("data-variant", "secondary");

    // Check trending icon
    expect(screen.getByTestId("icon-TrendingUp")).toBeInTheDocument();

    // Check active count
    expect(screen.getByText("3 active contributors")).toBeInTheDocument();

    // Check contributor cards
    const contributorCards = screen.getAllByTestId("contributor-card");
    expect(contributorCards).toHaveLength(3);
    expect(contributorCards[0]).toHaveAttribute("data-login", "leader1");
    expect(contributorCards[1]).toHaveAttribute("data-login", "leader2");
    expect(contributorCards[2]).toHaveAttribute("data-login", "leader3");
  });

  it("shows additional contributors message for large lists", () => {
    const largeRanking: ContributorRanking = {
      ...mockLeaderboardRanking,
      contributors: Array.from({ length: 10 }, (_, i) => ({
        login: `user-${i + 1}`,
        avatar_url: `https://example.com/avatar${i + 1}.jpg`,
        activity: {
          pullRequests: 5 - i,
          reviews: 3,
          comments: 2,
          totalScore: 20 - i,
          firstContributionDate: "2024-02-01T10:00:00Z",
        },
        rank: i + 1,
      })),
    };

    render(<ContributorOfTheMonthSimple ranking={largeRanking} />);

    // Should show only top 5 contributors
    const contributorCards = screen.getAllByTestId("contributor-card");
    expect(contributorCards).toHaveLength(5);

    // Should show "more contributors" text
    expect(screen.getByText("And 5 more contributors this month")).toBeInTheDocument();
  });

  it("has proper accessibility structure", () => {
    render(<ContributorOfTheMonthSimple ranking={mockLeaderboardRanking} />);

    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("role", "region");
    expect(card).toHaveAttribute("aria-labelledby", "contributor-heading");

    const title = screen.getByTestId("card-title");
    expect(title).toHaveAttribute("id", "contributor-heading");
  });

  it("applies custom className", () => {
    render(
      <ContributorOfTheMonthSimple
        ranking={mockLeaderboardRanking}
        className="custom-class"
      />
    );

    const card = screen.getByTestId("card");
    expect(card).toHaveClass("w-full", "custom-class");
  });

  it("handles empty contributors array in winner phase", () => {
    const emptyWinnerRanking = { ...mockWinnerRanking, contributors: [] };
    render(<ContributorOfTheMonthSimple ranking={emptyWinnerRanking} />);

    const emptyState = screen.getByTestId("empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveAttribute("data-type", "no_activity");
  });

  it("handles winner phase without runners-up", () => {
    const singleWinnerRanking = {
      ...mockWinnerRanking,
      contributors: [mockWinnerRanking.contributors[0]],
    };

    render(<ContributorOfTheMonthSimple ranking={singleWinnerRanking} />);

    // Should show winner
    expect(screen.getByText("January 2024 Winner")).toBeInTheDocument();

    // Should not show runners-up section
    expect(screen.queryByText("Top Contributors")).not.toBeInTheDocument();
    expect(screen.queryByText("runners-up")).not.toBeInTheDocument();
  });

  it("uses custom renderers when provided", () => {
    const customCardRenderer = ({ children, className }: any) => (
      <div data-testid="custom-card" className={className}>
        {children}
      </div>
    );

    render(
      <ContributorOfTheMonthSimple
        ranking={mockLeaderboardRanking}
        renderCard={customCardRenderer}
      />
    );

    expect(screen.getByTestId("custom-card")).toBeInTheDocument();
    expect(screen.queryByTestId("card")).not.toBeInTheDocument();
  });
});