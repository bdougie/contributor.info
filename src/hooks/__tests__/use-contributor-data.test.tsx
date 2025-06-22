import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useContributorData } from "../use-contributor-data";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { fetchUserOrganizations } from "@/lib/github";
import type { PullRequest } from "@/lib/types";
import React from "react";

// Mock the GitHub API function
vi.mock("@/lib/github", () => ({
  fetchUserOrganizations: vi.fn(),
}));

describe("useContributorData", () => {
  // Mock pull requests
  const mockPullRequests: PullRequest[] = [
    {
      id: 1,
      number: 101,
      title: "Fix login issue",
      state: "closed",
      created_at: "2023-01-10T10:00:00Z",
      updated_at: "2023-01-11T11:00:00Z",
      merged_at: "2023-01-11T12:00:00Z",
      additions: 20,
      deletions: 5,
      repository_owner: "testorg",
      repository_name: "testrepo",
      user: {
        id: 123,
        login: "testuser",
        avatar_url: "https://example.com/testuser.png",
      },
    },
    {
      id: 2,
      number: 102,
      title: "Add new feature",
      state: "closed",
      created_at: "2023-01-15T09:00:00Z",
      updated_at: "2023-01-16T10:00:00Z",
      merged_at: "2023-01-16T11:00:00Z",
      additions: 150,
      deletions: 10,
      repository_owner: "testorg",
      repository_name: "testrepo",
      user: {
        id: 123,
        login: "testuser",
        avatar_url: "https://example.com/testuser.png",
      },
    },
    {
      id: 3,
      number: 103,
      title: "Update docs",
      state: "closed",
      created_at: "2023-01-20T14:00:00Z",
      updated_at: "2023-01-21T15:00:00Z",
      merged_at: "2023-01-21T16:00:00Z",
      additions: 50,
      deletions: 30,
      repository_owner: "testorg",
      repository_name: "testrepo",
      user: {
        id: 456,
        login: "otheruser",
        avatar_url: "https://example.com/otheruser.png",
      },
    },
  ];

  // Mock organizations
  const mockOrgs = [
    {
      login: "testorg",
      avatar_url: "https://example.com/testorg.png",
    },
    {
      login: "anotherorg",
      avatar_url: "https://example.com/anotherorg.png",
    },
  ];

  // Setup mock for fetchUserOrganizations
  beforeEach(() => {
    vi.mocked(fetchUserOrganizations).mockResolvedValue(mockOrgs);

    // Clear the console.log/error mocks
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("should return contributor data for a user with PRs", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: mockPullRequests,
            loading: false,
            error: null,
          },
          lotteryFactor: null,
          directCommitsData: null,
          includeBots: false,
          setIncludeBots: vi.fn(),
        }}
      >
        {children}
      </RepoStatsContext.Provider>
    );

    const { result } = renderHook(
      () =>
        useContributorData({
          username: "testuser",
          avatarUrl: "https://example.com/testuser.png",
        }),
      { wrapper }
    );

    // Initial state
    expect(result.current.login).toBe("testuser");
    expect(result.current.avatar_url).toBe("https://example.com/testuser.png");
    expect(result.current.pullRequests).toBe(0);
    expect(result.current.percentage).toBe(0);

    // Wait for the effect to run - using Vitest's waitFor
    await vi.waitFor(() => {
      expect(result.current.pullRequests).toBe(2); // Should find 2 PRs for testuser
    });

    // Check updated state
    expect(result.current.percentage).toBe((2 / mockPullRequests.length) * 100);
    expect(result.current.organizations).toEqual(mockOrgs);
    expect(result.current.recentPRs?.length).toBe(2);
  });

  it("should handle API errors gracefully", async () => {
    // Setup error case and clear any cached data
    vi.mocked(fetchUserOrganizations).mockRejectedValue(new Error("API Error"));

    // Use a clean mock context to avoid any cache interference
    const testPullRequests = [...mockPullRequests];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: testPullRequests,
            loading: false,
            error: null,
          },
          lotteryFactor: null,
          directCommitsData: null,
          includeBots: false,
          setIncludeBots: vi.fn(),
        }}
      >
        {children}
      </RepoStatsContext.Provider>
    );

    // Use a unique username to avoid cache hits
    const { result } = renderHook(
      () =>
        useContributorData({
          username: "error-test-user",
          avatarUrl: "https://example.com/testuser.png",
        }),
      { wrapper }
    );

    // Wait for the effect to run and verify organizations is empty
    await vi.waitFor(() => {
      expect(result.current.organizations).toEqual([]);
    });

    // Should still have PR data but empty organizations due to error handling
  });

  it("should handle users with no PRs", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: mockPullRequests,
            loading: false,
            error: null,
          },
          lotteryFactor: null,
          directCommitsData: null,
          includeBots: false,
          setIncludeBots: vi.fn(),
        }}
      >
        {children}
      </RepoStatsContext.Provider>
    );

    const { result } = renderHook(
      () =>
        useContributorData({
          username: "nonexistentuser",
          avatarUrl: "https://example.com/nonexistent.png",
        }),
      { wrapper }
    );

    // Wait for the effect to run
    await vi.waitFor(() => {
      expect(result.current.login).toBe("nonexistentuser");
    });

    // Should have 0 PRs and 0 percentage
    expect(result.current.pullRequests).toBe(0);
    expect(result.current.percentage).toBe(0);
  });

  it("should use cache for repeat requests for the same user", async () => {
    // Reset mock counters before this test
    vi.clearAllMocks();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: mockPullRequests,
            loading: false,
            error: null,
          },
          lotteryFactor: null,
          directCommitsData: null,
          includeBots: false,
          setIncludeBots: vi.fn(),
        }}
      >
        {children}
      </RepoStatsContext.Provider>
    );

    // First render - should call the API
    renderHook(
      () =>
        useContributorData({
          username: "cache-test-user",
          avatarUrl: "https://example.com/testuser.png",
        }),
      { wrapper }
    );

    // Wait for the first render to complete
    await vi.waitFor(() => {
      // Make sure the organizations API was called
      expect(fetchUserOrganizations).toHaveBeenCalled();
    });

    // Reset the mock to track new calls
    vi.mocked(fetchUserOrganizations).mockClear();

    // Second render - should use cache and not call the API again
    const { result: result2 } = renderHook(
      () =>
        useContributorData({
          username: "cache-test-user",
          avatarUrl: "https://example.com/testuser.png",
        }),
      { wrapper }
    );

    // Wait for the second hook to complete rendering
    await vi.waitFor(() => {
      expect(result2.current.login).toBe("cache-test-user");
    });

    // The API should not be called again for the second render
    expect(fetchUserOrganizations).not.toHaveBeenCalled();
  });
});
