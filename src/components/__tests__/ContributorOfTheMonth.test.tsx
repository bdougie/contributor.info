import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom"; // Add this import for DOM assertions
import { ContributorOfTheMonth } from "../contributor-of-the-month";
import { ContributorRanking, MonthlyContributor } from "@/lib/types";
import { TestRepoStatsProvider } from "./test-utils";

// Mock data for testing
const mockContributors: MonthlyContributor[] = [
  {
    login: "top-contributor",
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
    login: "second-contributor",
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
  {
    login: "third-contributor",
    avatar_url: "https://example.com/avatar3.jpg",
    activity: {
      pullRequests: 5,
      reviews: 8,
      comments: 12,
      totalScore: 65,
      firstContributionDate: "2024-01-10T09:15:00Z",
    },
    rank: 3,
  },
];

const mockWinnerRanking: ContributorRanking = {
  month: "January",
  year: 2024,
  contributors: mockContributors,
  winner: mockContributors[0],
  phase: "winner_announcement",
};

const mockLeaderboardRanking: ContributorRanking = {
  month: "February",
  year: 2024,
  contributors: mockContributors.map((c) => ({ ...c, isWinner: false })),
  phase: "running_leaderboard",
};

const mockMinimalActivityRanking: ContributorRanking = {
  month: "March",
  year: 2024,
  contributors: [
    {
      login: "minimal-contributor",
      avatar_url: "https://example.com/avatar.jpg",
      activity: {
        pullRequests: 1,
        reviews: 0,
        comments: 2,
        totalScore: 7,
        firstContributionDate: "2024-03-01T10:00:00Z",
      },
      rank: 1,
    },
  ],
  phase: "running_leaderboard",
};

describe("ContributorOfTheMonth", () => {
  it("renders loading state correctly", () => {
    render(<ContributorOfTheMonth ranking={null} loading={true} />);

    expect(screen.getByText("Contributor of the Month")).toBeInTheDocument();
    expect(
      screen.getByText("Loading contributor rankings...")
    ).toBeInTheDocument();
    // Loading spinner should be present
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it("renders error state correctly", () => {
    const errorMessage = "Failed to load contributor data";
    render(<ContributorOfTheMonth ranking={null} error={errorMessage} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it("renders no activity state correctly", () => {
    render(<ContributorOfTheMonth ranking={null} />);

    expect(screen.getByText("No Activity This Month")).toBeInTheDocument();
    expect(
      screen.getByText("No contributor activity found for the current period.")
    ).toBeInTheDocument();
  });

  it("renders winner announcement phase correctly", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockWinnerRanking} />
      </TestRepoStatsProvider>
    );

    expect(screen.getByText("Contributor of the Month")).toBeInTheDocument();
    expect(screen.getByText("Celebrating January 2024's top contributor")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
    expect(screen.getByText("January 2024 Winner")).toBeInTheDocument();
    expect(screen.getByText("top-contributor")).toBeInTheDocument();
  });

  it("renders running leaderboard phase correctly", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockLeaderboardRanking} />
      </TestRepoStatsProvider>
    );

    expect(screen.getByText("Monthly Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("Top contributors for February 2024")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("3 active contributors")).toBeInTheDocument();
  });

  it("shows top 5 contributors only", () => {
    const manyContributors = Array.from({ length: 10 }, (_, i) => ({
      login: `contributor-${i + 1}`,
      avatar_url: `https://example.com/avatar${i + 1}.jpg`,
      activity: {
        pullRequests: 5 - i,
        reviews: 3,
        comments: 2,
        totalScore: 20 - i,
        firstContributionDate: "2024-01-01T10:00:00Z",
      },
      rank: i + 1,
    }));

    const largeRanking: ContributorRanking = {
      month: "April",
      year: 2024,
      contributors: manyContributors,
      phase: "running_leaderboard",
    };

    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={largeRanking} />
      </TestRepoStatsProvider>
    );

    // Should show "And X more contributors..."
    expect(
      screen.getByText(/And.*more contributors this month/)
    ).toBeInTheDocument();

    // Should only show first 5 contributors
    expect(screen.getByText("contributor-1")).toBeInTheDocument();
    expect(screen.getByText("contributor-5")).toBeInTheDocument();
    expect(screen.queryByText("contributor-6")).not.toBeInTheDocument();
  });

  it("handles minimal activity by showing MinimalActivityDisplay", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockMinimalActivityRanking} />
      </TestRepoStatsProvider>
    );

    expect(screen.getByText("Early Activity - March 2024")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(
      screen.getByText("1 contributor • 7 total points")
    ).toBeInTheDocument();
  });

  it("shows winner details in winner phase", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockWinnerRanking} />
      </TestRepoStatsProvider>
    );

    // Winner should be displayed
    expect(screen.getByText("top-contributor")).toBeInTheDocument();
    expect(screen.getByText("Score: 115")).toBeInTheDocument();

    // Top contributors section should show the other contributors
    expect(screen.getByText("Top Contributors")).toBeInTheDocument();
    expect(screen.getByText("second-contributor")).toBeInTheDocument();
    expect(screen.getByText("third-contributor")).toBeInTheDocument();
  });

  it("has proper accessibility structure", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockLeaderboardRanking} />
      </TestRepoStatsProvider>
    );

    const mainRegion = screen.getByRole("region");
    expect(mainRegion).toBeInTheDocument();
    expect(mainRegion).toHaveAttribute("aria-labelledby", "contributor-heading");

    const heading = screen.getByText("Monthly Leaderboard");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute("id", "contributor-heading");
  });

  it("displays correct time information", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockWinnerRanking} />
      </TestRepoStatsProvider>
    );

    // Check that the date is displayed in the description
    expect(screen.getByText("Celebrating January 2024's top contributor")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth
          ranking={mockLeaderboardRanking}
          className="custom-class"
        />
      </TestRepoStatsProvider>
    );

    const card = screen.getByRole("region");
    expect(card).toHaveClass("custom-class");
  });

  it("handles empty contributors array", () => {
    const emptyRanking: ContributorRanking = {
      month: "May",
      year: 2024,
      contributors: [],
      phase: "running_leaderboard",
    };

    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={emptyRanking} />
      </TestRepoStatsProvider>
    );

    expect(screen.getByText("No Activity This Month")).toBeInTheDocument();
  });

  it("shows appropriate phase badges", () => {
    const { rerender } = render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockWinnerRanking} />
      </TestRepoStatsProvider>
    );

    const winnerBadge = screen.getByText("Winner");
    expect(winnerBadge).toBeInTheDocument();

    rerender(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockLeaderboardRanking} />
      </TestRepoStatsProvider>
    );

    const leaderboardBadge = screen.getByText("Current");
    expect(leaderboardBadge).toBeInTheDocument();
  });

  it("shows correct contributor count in leaderboard mode", () => {
    render(
      <TestRepoStatsProvider>
        <ContributorOfTheMonth ranking={mockLeaderboardRanking} />
      </TestRepoStatsProvider>
    );

    expect(
      screen.getByText("3 active contributors")
    ).toBeInTheDocument();
  });
});
