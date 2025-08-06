import { describe, it, expect } from "vitest";
import {
  createTooltipContent,
  getCardClasses,
  getCardAccessibility,
  getAvatarFallback,
  getActivityItems,
} from "../contributor-card-config";
import type { MonthlyContributor } from "../types";

describe("contributor-card-config", () => {
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

  describe("createTooltipContent", () => {
    it("creates correct tooltip content structure", () => {
      const content = createTooltipContent(mockContributor);

      expect(content.title).toBe("testuser's Activity");
      expect(content.items).toHaveLength(3);
      expect(content.items[0]).toEqual({
        iconName: "GitPullRequest",
        label: "Pull Requests",
        count: 15,
      });
      expect(content.items[1]).toEqual({
        iconName: "GitPullRequestDraft",
        label: "Reviews",
        count: 10,
      });
      expect(content.items[2]).toEqual({
        iconName: "MessageSquare",
        label: "Comments",
        count: 25,
      });
    });

    it("handles zero activity correctly", () => {
      const zeroActivityContributor = {
        ...mockContributor,
        activity: {
          ...mockContributor.activity,
          pullRequests: 0,
          reviews: 0,
          comments: 0,
          totalScore: 0,
        },
      };

      const content = createTooltipContent(zeroActivityContributor);

      expect(content.items[0].count).toBe(0);
      expect(content.items[1].count).toBe(0);
      expect(content.items[2].count).toBe(0);
    });
  });

  describe("getCardClasses", () => {
    it("returns winner classes for winners", () => {
      const classes = getCardClasses(true);

      expect(classes.container).toContain("ring-2 ring-yellow-500");
      expect(classes.container).toContain("bg-yellow-50/10 dark:bg-yellow-900/10");
      expect(classes.rank).toBe("default");
    });

    it("returns default classes for non-winners", () => {
      const classes = getCardClasses(false);

      expect(classes.container).not.toContain("ring-2 ring-yellow-500");
      expect(classes.container).toContain("relative p-4 rounded-lg border bg-card");
      expect(classes.rank).toBe("default");
    });

    it("includes base classes for all cards", () => {
      const winnerClasses = getCardClasses(true);
      const regularClasses = getCardClasses(false);

      const basePattern = "relative p-4 rounded-lg border bg-card transition-all cursor-pointer";
      expect(winnerClasses.container).toContain(basePattern);
      expect(regularClasses.container).toContain(basePattern);
    });
  });

  describe("getCardAccessibility", () => {
    it("creates correct accessibility for winner", () => {
      const accessibility = getCardAccessibility("testuser", 50, true);

      expect(accessibility.role).toBe("article");
      expect(accessibility.label).toBe("testuser - Winner, 50 points");
    });

    it("creates correct accessibility for non-winner", () => {
      const accessibility = getCardAccessibility("testuser", 50, false);

      expect(accessibility.role).toBe("listitem");
      expect(accessibility.label).toBe("testuser, 50 points");
    });

    it("handles zero score correctly", () => {
      const accessibility = getCardAccessibility("testuser", 0, false);

      expect(accessibility.label).toBe("testuser, 0 points");
    });
  });

  describe("getAvatarFallback", () => {
    it("returns first letter uppercase", () => {
      expect(getAvatarFallback("testuser")).toBe("T");
      expect(getAvatarFallback("alice")).toBe("A");
      expect(getAvatarFallback("bob-smith")).toBe("B");
    });

    it("handles empty string gracefully", () => {
      expect(getAvatarFallback("")).toBe("");
    });

    it("handles single character", () => {
      expect(getAvatarFallback("a")).toBe("A");
    });
  });

  describe("getActivityItems", () => {
    it("returns activity items in correct order", () => {
      const items = getActivityItems(mockContributor.activity);

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        iconName: "GitPullRequest",
        count: 15,
      });
      expect(items[1]).toEqual({
        iconName: "GitPullRequestDraft",
        count: 10,
      });
      expect(items[2]).toEqual({
        iconName: "MessageSquare",
        count: 25,
      });
    });

    it("handles zero values", () => {
      const zeroActivity = {
        pullRequests: 0,
        reviews: 0,
        comments: 0,
        totalScore: 0,
        firstContributionDate: "2024-01-01",
      };

      const items = getActivityItems(zeroActivity);

      expect(items[0].count).toBe(0);
      expect(items[1].count).toBe(0);
      expect(items[2].count).toBe(0);
    });
  });
});