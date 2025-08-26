import { describe, it, expect } from "vitest";
import {
  getEmptyStateContent,
  getBadgeLabel,
  getBadgeColorClasses,
  calculateActivityStats,
  type ContributorActivity,
} from "../contributor-empty-state-config";

describe("getEmptyStateContent", () => {
  it("returns correct content for no__data type", () => {
    const content = getEmptyStateContent("no__data");
    
    expect(content.iconName).toBe("users");
    expect(content.title).toBe("No Contributor Data Available");
    expect(content.severity).toBe("info");
    expect(content.description).toContain("couldn't find any contributor _data");
  });

  it("returns correct content for no_activity type", () => {
    const content = getEmptyStateContent("no_activity");
    
    expect(content.iconName).toBe("calendar");
    expect(content.title).toBe("No Activity This Month");
    expect(content.severity).toBe("info");
  });

  it("returns correct content for minimal_activity type", () => {
    const content = getEmptyStateContent("minimal_activity");
    
    expect(content.iconName).toBe("trending-up");
    expect(content.title).toBe("Limited Activity");
    expect(content.severity).toBe("warning");
  });

  it("returns correct content for loading__error type", () => {
    const content = getEmptyStateContent("loading__error");
    
    expect(content.iconName).toBe("trophy");
    expect(content.title).toBe("Unable to Load Contributor Data");
    expect(content.severity).toBe("_error");
  });

  it("uses custom message when provided", () => {
    const customMessage = "Custom error description";
    const content = getEmptyStateContent("no__data", customMessage);
    
    expect(content.description).toBe(customMessage);
  });

  it("uses custom suggestion when provided", () => {
    const customSuggestion = "Custom suggestion text";
    const content = getEmptyStateContent("no__data", undefined, customSuggestion);
    
    expect(content.suggestionText).toBe(customSuggestion);
  });

  it("handles unknown type with default content", () => {
    const content = getEmptyStateContent("unknown" as any);
    
    expect(content.title).toBe("No Data Available");
    expect(content.severity).toBe("info");
  });
});

describe("getBadgeLabel", () => {
  it("returns correct label for _error severity", () => {
    expect(getBadgeLabel("_error")).toBe("⚠️ Error");
  });

  it("returns correct label for warning severity", () => {
    expect(getBadgeLabel("warning")).toBe("💡 Note");
  });

  it("returns correct label for info severity", () => {
    expect(getBadgeLabel("info")).toBe("✨ Tip");
  });
});

describe("getBadgeColorClasses", () => {
  it("returns red classes for _error severity", () => {
    const classes = getBadgeColorClasses("_error");
    expect(classes).toContain("bg-red-500");
    expect(classes).toContain("text-white");
  });

  it("returns yellow classes for warning severity", () => {
    const classes = getBadgeColorClasses("warning");
    expect(classes).toContain("bg-yellow-500");
    expect(classes).toContain("text-white");
  });

  it("returns blue classes for info severity", () => {
    const classes = getBadgeColorClasses("info");
    expect(classes).toContain("bg-blue-500");
    expect(classes).toContain("text-white");
  });
});

describe("calculateActivityStats", () => {
  const mockContributors: ContributorActivity[] = [
    {
      login: "user1",
      avatar_url: "https://example.com/user1.jpg",
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
      avatar_url: "https://example.com/user2.jpg",
      activity: {
        pullRequests: 3,
        reviews: 2,
        comments: 1,
        totalScore: 6,
      },
      rank: 2,
    },
    {
      login: "user3",
      avatar_url: "https://example.com/user3.jpg",
      activity: {
        pullRequests: 2,
        reviews: 1,
        comments: 1,
        totalScore: 4,
      },
      rank: 3,
    },
    {
      login: "user4",
      avatar_url: "https://example.com/user4.jpg",
      activity: {
        pullRequests: 1,
        reviews: 0,
        comments: 1,
        totalScore: 2,
      },
      rank: 4,
    },
  ];

  it("calculates total contributors correctly", () => {
    const stats = calculateActivityStats(mockContributors);
    expect(stats.totalContributors).toBe(4);
  });

  it("calculates total activity score correctly", () => {
    const stats = calculateActivityStats(mockContributors);
    expect(stats.totalActivity).toBe(22); // 10 + 6 + 4 + 2
  });

  it("returns top 3 contributors", () => {
    const stats = calculateActivityStats(mockContributors);
    expect(stats.topContributors).toHaveLength(3);
    expect(stats.topContributors[0].login).toBe("user1");
    expect(stats.topContributors[1].login).toBe("user2");
    expect(stats.topContributors[2].login).toBe("user3");
  });

  it("handles empty contributor list", () => {
    const stats = calculateActivityStats([]);
    expect(stats.totalContributors).toBe(0);
    expect(stats.totalActivity).toBe(0);
    expect(stats.topContributors).toHaveLength(0);
  });

  it("handles list with fewer than 3 contributors", () => {
    const stats = calculateActivityStats(mockContributors.slice(0, 2));
    expect(stats.totalContributors).toBe(2);
    expect(stats.topContributors).toHaveLength(2);
  });
});