import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom"; // Add this import for DOM assertions
import { ContributorOfTheMonth } from "../ContributorOfTheMonth";
import { ContributorRanking, MonthlyContributor } from "@/lib/types";

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
    expect(
      screen.getByLabelText("Loading contributor data")
    ).toBeInTheDocument();
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
    render(<ContributorOfTheMonth ranking={mockWinnerRanking} />);

    expect(screen.getByText("Contributor of the Month")).toBeInTheDocument();
    expect(screen.getByText("January 2024")).toBeInTheDocument();
    expect(screen.getByText(/Winner Announcement/)).toBeInTheDocument();
    expect(
      screen.getByText(/Congratulations to our January 2024 Winner!/)
    ).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
    expect(screen.getByText("top-contributor")).toBeInTheDocument();
  });

  it("renders running leaderboard phase correctly", () => {
    render(<ContributorOfTheMonth ranking={mockLeaderboardRanking} />);

    expect(screen.getByText("Current Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("February 2024")).toBeInTheDocument();
    expect(screen.getByText(/Running Tally/)).toBeInTheDocument();
    expect(screen.getByText("This Month's Leaders")).toBeInTheDocument();
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

    render(<ContributorOfTheMonth ranking={largeRanking} />);

    // Should show "And X more contributors..."
    expect(
      screen.getByText(/more contributors contributing this month/)
    ).toBeInTheDocument();
    expect(screen.getByText(/And/)).toBeInTheDocument(); // Just check that "And" appears

    // Should only show first 5 contributors
    expect(screen.getByText("contributor-1")).toBeInTheDocument();
    expect(screen.getByText("contributor-5")).toBeInTheDocument();
    expect(screen.queryByText("contributor-6")).not.toBeInTheDocument();
  });

  it("handles minimal activity by showing MinimalActivityDisplay", () => {
    render(<ContributorOfTheMonth ranking={mockMinimalActivityRanking} />);

    expect(screen.getByText("Early Activity - March 2024")).toBeInTheDocument();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(
      screen.getByText("1 contributor • 7 total points")
    ).toBeInTheDocument();
  });

  it("shows winner details in winner phase", () => {
    render(<ContributorOfTheMonth ranking={mockWinnerRanking} />);

    // Winner should be displayed
    expect(screen.getByText("top-contributor")).toBeInTheDocument();
    expect(screen.getAllByText("Score:")[0]).toBeInTheDocument(); // Use getAllByText and take first
    expect(screen.getByText("115")).toBeInTheDocument();

    // Top contributors section should show the other contributors
    expect(screen.getByText("Top Contributors")).toBeInTheDocument();
    expect(screen.getByText("second-contributor")).toBeInTheDocument();
    expect(screen.getByText("third-contributor")).toBeInTheDocument();
  });

  it("has proper accessibility structure", () => {
    render(<ContributorOfTheMonth ranking={mockLeaderboardRanking} />);

    const mainRegion = screen.getByRole("region", {
      name: /Current Leaderboard/,
    });
    expect(mainRegion).toBeInTheDocument();

    const heading = screen.getByRole("heading", {
      name: /Current Leaderboard/,
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute("id", "contributor-heading");

    const contributorList = screen.getByRole("list", {
      name: "Current month contributor leaderboard",
    });
    expect(contributorList).toBeInTheDocument();
  });

  it("displays correct time information", () => {
    render(<ContributorOfTheMonth ranking={mockWinnerRanking} />);

    const timeElement = screen.getByText("January 2024");
    expect(timeElement.tagName.toLowerCase()).toBe("time");
  });

  it("applies custom className", () => {
    render(
      <ContributorOfTheMonth
        ranking={mockLeaderboardRanking}
        className="custom-class"
      />
    );

    const card = screen.getByRole("region", { name: /Current Leaderboard/ });
    expect(card).toHaveClass("custom-class");
  });

  it("handles empty contributors array", () => {
    const emptyRanking: ContributorRanking = {
      month: "May",
      year: 2024,
      contributors: [],
      phase: "running_leaderboard",
    };

    render(<ContributorOfTheMonth ranking={emptyRanking} />);

    expect(screen.getByText("No Activity This Month")).toBeInTheDocument();
  });

  it("shows appropriate phase badges", () => {
    const { rerender } = render(
      <ContributorOfTheMonth ranking={mockWinnerRanking} />
    );

    const winnerBadge = screen.getByText(/Winner Announcement/);
    expect(winnerBadge).toBeInTheDocument();

    rerender(<ContributorOfTheMonth ranking={mockLeaderboardRanking} />);

    const leaderboardBadge = screen.getByText(/Running Tally/);
    expect(leaderboardBadge).toBeInTheDocument();
  });

  it("shows correct contributor count in leaderboard mode", () => {
    render(<ContributorOfTheMonth ranking={mockLeaderboardRanking} />);

    expect(
      screen.getByLabelText("3 active contributors this month")
    ).toBeInTheDocument();
  });
});
