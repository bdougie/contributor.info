import { describe, it, expect } from "vitest";
import type { PullRequest } from "@/lib/types";

// Import the getLanguageStats function
// Note: For this test to work, you'll need to extract the getLanguageStats function from the Distribution component
// into a separate utility file like src/lib/language-stats.ts
import { getLanguageStats } from "@/lib/language-stats";

describe("Language Statistics Logic", () => {
  // Sample PR data for testing
  const mockPullRequests: PullRequest[] = [
    {
      id: 1,
      title: "Add TypeScript feature",
      number: 1,
      commits: [
        { additions: 100, deletions: 10, language: "TypeScript" },
        { additions: 20, deletions: 5, language: "CSS" },
      ],
      additions: 120,
      deletions: 15,
      state: "closed",
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-02T00:00:00Z",
      merged_at: "2023-01-02T00:00:00Z",
      repository_owner: "testorg",
      repository_name: "testrepo",
      user: {
        id: 123,
        login: "user1",
        avatar_url: "https://example.com/avatar1.jpg",
      },
    },
    {
      id: 2,
      title: "Fix JavaScript bug",
      number: 2,
      commits: [{ additions: 5, deletions: 50, language: "JavaScript" }],
      additions: 5,
      deletions: 50,
      state: "closed",
      created_at: "2023-01-03T00:00:00Z",
      updated_at: "2023-01-04T00:00:00Z",
      merged_at: "2023-01-04T00:00:00Z",
      repository_owner: "testorg",
      repository_name: "testrepo",
      user: {
        id: 456,
        login: "user2",
        avatar_url: "https://example.com/avatar2.jpg",
      },
    },
    {
      id: 3,
      title: "Update HTML template",
      number: 3,
      commits: [{ additions: 30, deletions: 15, language: "HTML" }],
      additions: 30,
      deletions: 15,
      state: "closed",
      created_at: "2023-01-05T00:00:00Z",
      updated_at: "2023-01-06T00:00:00Z",
      merged_at: "2023-01-06T00:00:00Z",
      repository_owner: "testorg",
      repository_name: "testrepo",
      user: {
        id: 789,
        login: "user3",
        avatar_url: "https://example.com/avatar3.jpg",
      },
    },
    {
      id: 4,
      title: "More TypeScript improvements",
      number: 4,
      commits: [{ additions: 80, deletions: 25, language: "TypeScript" }],
      additions: 80,
      deletions: 25,
      state: "closed",
      created_at: "2023-01-07T00:00:00Z",
      updated_at: "2023-01-08T00:00:00Z",
      merged_at: "2023-01-08T00:00:00Z",
      repository_owner: "testorg",
      repository_name: "testrepo",
      user: {
        id: 123,
        login: "user1",
        avatar_url: "https://example.com/avatar1.jpg",
      },
    },
  ];

  it("correctly counts languages from PR commits", () => {
    const languageStats = getLanguageStats(mockPullRequests);

    // Check if the stats are sorted by count (descending)
    expect(languageStats[0].name).toBe("TypeScript");
    expect(languageStats[0].count).toBe(2); // Two PRs contain TypeScript

    // Check that all languages are present
    const languages = languageStats.map((lang) => lang.name);
    expect(languages).toContain("TypeScript");
    expect(languages).toContain("JavaScript");
    expect(languages).toContain("HTML");
    expect(languages).toContain("CSS");
  });

  it("handles PRs without commit data", () => {
    // PRs without commit data should still be analyzed based on title
    const prsWithoutCommits: PullRequest[] = [
      {
        id: 5,
        title: "Update .ts files for better typing",
        number: 5,
        commits: undefined,
        additions: 50,
        deletions: 20,
        state: "closed",
        created_at: "2023-01-09T00:00:00Z",
        updated_at: "2023-01-10T00:00:00Z",
        merged_at: "2023-01-10T00:00:00Z",
        repository_owner: "testorg",
        repository_name: "testrepo",
        user: {
          id: 123,
          login: "user1",
          avatar_url: "https://example.com/avatar1.jpg",
        },
      },
      {
        id: 6,
        title: "Add new CSS styling",
        number: 6,
        commits: undefined,
        additions: 100,
        deletions: 10,
        state: "closed",
        created_at: "2023-01-11T00:00:00Z",
        updated_at: "2023-01-12T00:00:00Z",
        merged_at: "2023-01-12T00:00:00Z",
        repository_owner: "testorg",
        repository_name: "testrepo",
        user: {
          id: 456,
          login: "user2",
          avatar_url: "https://example.com/avatar2.jpg",
        },
      },
    ];

    const languageStats = getLanguageStats(prsWithoutCommits);

    // Check that it extracted languages from titles
    const languages = languageStats.map((lang) => lang.name);
    expect(languages).toContain("TypeScript");
    expect(languages).toContain("CSS");
  });

  it("returns fallback data when no PRs are provided", () => {
    const emptyPRs: PullRequest[] = [];
    const languageStats = getLanguageStats(emptyPRs);

    // Should return a single "No Data" entry
    expect(languageStats.length).toBe(1);
    expect(languageStats[0].name).toBe("No Data");
    expect(languageStats[0].count).toBe(0);
  });

  it("returns estimated data when PRs have no language info", () => {
    // PRs without any language information in commits or title
    const prsWithoutLanguageInfo: PullRequest[] = [
      {
        id: 7,
        title: "Miscellaneous updates",
        number: 7,
        commits: undefined,
        additions: 50,
        deletions: 20,
        state: "closed",
        created_at: "2023-01-13T00:00:00Z",
        updated_at: "2023-01-14T00:00:00Z",
        merged_at: "2023-01-14T00:00:00Z",
        repository_owner: "testorg",
        repository_name: "testrepo",
        user: {
          id: 123,
          login: "user1",
          avatar_url: "https://example.com/avatar1.jpg",
        },
      },
    ];

    // Mock the languageMap.size check to force fallback data
    const originalMap = global.Map;
    global.Map = class MockMap extends Map {
      constructor() {
        super();
      }
      get size() {
        return 0; // Force fallback data path
      }
    } as any;

    const languageStats = getLanguageStats(prsWithoutLanguageInfo);

    // Restore original Map
    global.Map = originalMap;

    // Should return estimated data with "estimated" in the name
    expect(languageStats.length).toBeGreaterThan(0);
    expect(languageStats[0].name).toContain("estimated");
  });
});
