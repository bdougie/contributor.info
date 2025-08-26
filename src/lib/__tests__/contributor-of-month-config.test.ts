import { describe, it, expect } from "vitest";
import {
  getComponentState,
  getDisplayContent,
  getWinnerDisplayContent,
  getLeaderboardDisplayContent,
  getCardAccessibility,
  getTrophyIconProps,
} from "../contributor-of-month-config";
import type { ContributorRanking } from "../types";

describe("contributor-of-month-config", () => {
  const mockRanking: ContributorRanking = {
    month: "January",
    year: 2024,
    contributors: [
      {
        login: "user1",
        avatar_url: "https://example.com/avatar1.jpg",
        activity: {
          pullRequests: 10,
          reviews: 5,
          comments: 8,
          totalScore: 23,
          firstContributionDate: "2024-01-01",
        },
        rank: 1,
        isWinner: true,
      },
      {
        login: "user2",
        avatar_url: "https://example.com/avatar2.jpg",
        activity: {
          pullRequests: 7,
          reviews: 4,
          comments: 6,
          totalScore: 17,
          firstContributionDate: "2024-01-02",
        },
        rank: 2,
      },
    ],
    winner: {
      login: "user1",
      avatar_url: "https://example.com/avatar1.jpg",
      activity: {
        pullRequests: 10,
        reviews: 5,
        comments: 8,
        totalScore: 23,
        firstContributionDate: "2024-01-01",
      },
      rank: 1,
      isWinner: true,
    },
    phase: "winner_announcement",
  };

  describe("getComponentState", () => {
    it("returns loading state when loading is true", () => {
      const state = getComponentState(null, true, null);
      expect(state).toEqual({ type: "loading" });
    });

    it("returns error state when _error is provided", () => {
      const errorMessage = "Test error";
      const state = getComponentState(null, false, _errorMessage);
      expect(state).toEqual({ type: "error", message: _errorMessage });
    });

    it("returns no_activity state when ranking is null", () => {
      const state = getComponentState(null, false, null);
      expect(state).toEqual({ type: "no_activity" });
    });

    it("returns no_activity state when contributors array is empty", () => {
      const emptyRanking = { ...mockRanking, contributors: [] };
      const state = getComponentState(emptyRanking, false, null);
      expect(state).toEqual({ type: "no_activity" });
    });

    it("returns minimal_activity state for low activity non-winner phase", () => {
      const minimalRanking = {
        ...mockRanking,
        phase: "running_leaderboard" as const,
        contributors: [
          {
            ...mockRanking.contributors[0],
            activity: { ...mockRanking.contributors[0].activity, totalScore: 3 },
          },
        ],
      };
      const state = getComponentState(minimalRanking, false, null);
      
      expect(state.type).toBe("minimal_activity");
      if (state.type === "minimal_activity") {
        expect(state.contributors).toHaveLength(1);
        expect(state.month).toBe("January");
        expect(state.year).toBe(2024);
      }
    });

    it("returns winner_phase state for winner announcement phase", () => {
      const state = getComponentState(mockRanking, false, null);
      
      expect(state.type).toBe("winner_phase");
      if (state.type === "winner_phase") {
        expect(state.ranking).toBe(mockRanking);
        expect(state.topContributors).toHaveLength(2);
      }
    });

    it("returns leaderboard_phase state for running leaderboard", () => {
      const leaderboardRanking = {
        ...mockRanking,
        phase: "running_leaderboard" as const,
        // Add more contributors to avoid minimal activity condition
        contributors: [
          ...mockRanking.contributors,
          {
            login: "user3",
            avatar_url: "https://example.com/avatar3.jpg",
            activity: {
              pullRequests: 5,
              reviews: 3,
              comments: 4,
              totalScore: 12,
              firstContributionDate: "2024-01-03",
            },
            rank: 3,
          },
        ],
      };
      const state = getComponentState(leaderboardRanking, false, null);
      
      expect(state.type).toBe("leaderboard_phase");
      if (state.type === "leaderboard_phase") {
        expect(state.ranking).toBe(leaderboardRanking);
        expect(state.topContributors).toHaveLength(3);
      }
    });

    it("handles large contributor list by limiting to top 5", () => {
      const largeRanking = {
        ...mockRanking,
        contributors: Array.from({ length: 10 }, (_, i) => ({
          login: `user${i + 1}`,
          avatar_url: `https://example.com/avatar${i + 1}.jpg`,
          activity: {
            pullRequests: 10 - i,
            reviews: 5,
            comments: 8,
            totalScore: 23 - i,
            firstContributionDate: "2024-01-01",
          },
          rank: i + 1,
        })),
      };

      const state = getComponentState(largeRanking, false, null);
      
      if (state.type === "winner_phase") {
        expect(state.topContributors).toHaveLength(5);
      }
    });
  });

  describe("getDisplayContent", () => {
    it("returns winner phase content correctly", () => {
      const content = getDisplayContent(mockRanking, true);
      
      expect(content).toEqual({
        title: "Contributor of the Month",
        description: "Celebrating January 2024's top contributor",
        badgeText: "Winner",
        badgeVariant: "default",
      });
    });

    it("returns leaderboard phase content correctly", () => {
      const content = getDisplayContent(mockRanking, false);
      
      expect(content).toEqual({
        title: "Monthly Leaderboard",
        description: "Top contributors for January 2024",
        badgeText: "Current",
        badgeVariant: "secondary",
      });
    });
  });

  describe("getWinnerDisplayContent", () => {
    it("returns correct winner display content", () => {
      const topContributors = mockRanking.contributors; // Use all 2 contributors
      const content = getWinnerDisplayContent(mockRanking, topContributors);
      
      expect(content).toEqual({
        sectionTitle: "Winner Display",
        winnerTitle: "January 2024 Winner",
        runnersUpTitle: "Top Contributors",
        runnersUpCount: "1 runners-up", // 2 contributors - 1 winner = 1 runner-up
      });
    });

    it("handles single contributor correctly", () => {
      const singleContributor = [mockRanking.contributors[0]];
      const content = getWinnerDisplayContent(mockRanking, singleContributor);
      
      expect(content.runnersUpCount).toBe("0 runners-up");
    });
  });

  describe("getLeaderboardDisplayContent", () => {
    it("returns correct leaderboard content for multiple contributors", () => {
      const topContributors = mockRanking.contributors;
      const content = getLeaderboardDisplayContent(mockRanking, topContributors);
      
      expect(content.iconName).toBe("TrendingUp");
      expect(content.activeCount).toBe("2 active contributors");
      expect(content.moreContributorsText).toBeUndefined();
    });

    it("returns correct content for single contributor", () => {
      const singleContributor = [mockRanking.contributors[0]];
      const content = getLeaderboardDisplayContent(mockRanking, singleContributor);
      
      expect(content.activeCount).toBe("1 active contributor");
    });

    it("includes more contributors text when total > 5", () => {
      const rankingWith10 = {
        ...mockRanking,
        contributors: Array.from({ length: 10 }, (_, i) => mockRanking.contributors[0]),
      };
      const topContributors = rankingWith10.contributors.slice(0, 5);
      const content = getLeaderboardDisplayContent(rankingWith10, topContributors);
      
      expect(content.moreContributorsText).toBe("And 5 more contributors this month");
    });
  });

  describe("getCardAccessibility", () => {
    it("returns correct accessibility attributes", () => {
      const accessibility = getCardAccessibility();
      
      expect(accessibility).toEqual({
        role: "region",
        ariaLabelledBy: "contributor-heading",
      });
    });
  });

  describe("getTrophyIconProps", () => {
    it("returns correct trophy icon properties", () => {
      const props = getTrophyIconProps();
      
      expect(props).toEqual({
        iconName: "Trophy",
        className: "h-5 w-5 text-yellow-600",
        ariaLabel: "Trophy",
        role: "img",
      });
    });
  });
});