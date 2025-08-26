import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHierarchicalDistribution } from "../use-hierarchical-distribution";
import type { PullRequest } from "@/lib/types";

// Mock the ContributionAnalyzer
vi.mock("@/lib/contribution-analyzer", () => ({
  ContributionAnalyzer: {
    analyze: vi.fn(),
    resetCounts: vi.fn(),
  },
}));

const createMockPR = (
  id: number,
  login: string
): PullRequest => ({
  id,
  number: id,
  title: `PR ${id}`,
  state: "closed",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  merged_at: new Date().toISOString(),
  additions: 100,
  deletions: 50,
  repository_owner: "test-org",
  repository_name: "test-repo",
  user: {
    id,
    login,
    avatar_url: `https://avatars.githubusercontent.com/u/${id}`,
    type: "User",
  },
  html_url: `https://github.com/test-org/test-repo/pull/${id}`,
  commits: [],
});

describe("useHierarchicalDistribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null _data when no pull requests provided", () => {
    const { result } = renderHook(() => useHierarchicalDistribution([]));

    expect(result.current.hierarchicalData).toBeNull();
    expect(result.current.currentView).toBe("overview");
    expect(result.current.selectedQuadrant).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("processes pull requests into hierarchical structure", async () => {
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );

    const mockPRs = [
      createMockPR(1, "user1"),
      createMockPR(2, "user1"),
      createMockPR(3, "user2"),
      createMockPR(4, "user3"),
      createMockPR(5, "user1"),
    ];

    (ContributionAnalyzer.analyze as any).mockImplementation((pr: unknown) => ({
      quadrant:
        pr.id === 1 || pr.id === 2 || pr.id === 3
          ? "new"
          : pr.id === 4
          ? "maintenance"
          : "refactoring",
    }));

    const { result } = renderHook(() => useHierarchicalDistribution(mockPRs));

    expect(ContributionAnalyzer.resetCounts).toHaveBeenCalled();
    expect(ContributionAnalyzer.analyze).toHaveBeenCalledTimes(5);

    const data = result.current.hierarchicalData;
    expect(_data).not.toBeNull();
    expect(_data?.name).toBe("Distribution");
    expect(_data?.children).toHaveLength(4); // All quadrants

    // Check new features quadrant
    const newQuadrant = data?.children.find((q) => q.id === "new");
    expect(newQuadrant?.name).toBe("New Features");
    expect(newQuadrant?.value).toBe(3); // 3 PRs total
    expect(newQuadrant?.color).toBe("#60a5fa");
    expect(newQuadrant?.children).toHaveLength(2); // user1 and user2

    // Check contributor nodes
    const user1Node = newQuadrant?.children?.find((c) => c.login === "user1");
    expect(user1Node?.value).toBe(2); // 2 PRs from user1
    expect(user1Node?.prs).toHaveLength(2);
  });

  it("handles drill down and drill up navigation", async () => {
    const mockPRs = [createMockPR(1, "user1")];
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );
    (ContributionAnalyzer.analyze as any).mockReturnValue({ quadrant: "new" });

    const { result } = renderHook(() => useHierarchicalDistribution(mockPRs));

    expect(result.current.currentView).toBe("overview");
    expect(result.current.selectedQuadrant).toBeNull();

    // Drill down
    act(() => {
      result.current.drillDown("new");
    });

    expect(result.current.currentView).toBe("quadrant");
    expect(result.current.selectedQuadrant).toBe("new");

    // Drill up
    act(() => {
      result.current.drillUp();
    });

    expect(result.current.currentView).toBe("overview");
    expect(result.current.selectedQuadrant).toBeNull();
  });

  it("syncs with external selected quadrant", async () => {
    const mockPRs = [createMockPR(1, "user1")];
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );
    (ContributionAnalyzer.analyze as any).mockReturnValue({ quadrant: "new" });

    const { result, rerender } = renderHook(
      ({ externalQuadrant }: { externalQuadrant: string | null }) =>
        useHierarchicalDistribution(mockPRs, externalQuadrant),
      {
        initialProps: { externalQuadrant: null as string | null },
      }
    );

    expect(result.current.currentView).toBe("overview");
    expect(result.current.selectedQuadrant).toBeNull();

    // Update external quadrant
    rerender({ externalQuadrant: "maintenance" });

    expect(result.current.currentView).toBe("quadrant");
    expect(result.current.selectedQuadrant).toBe("maintenance");

    // Clear external quadrant
    rerender({ externalQuadrant: null });

    expect(result.current.currentView).toBe("overview");
    expect(result.current.selectedQuadrant).toBeNull();
  });

  it("limits contributors to top 20 per quadrant", async () => {
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );

    // Create 25 users with PRs in the same quadrant
    const mockPRs = Array.from({ length: 25 }, (_, i) =>
      createMockPR(i + 1, `user${i + 1}`)
    );

    (ContributionAnalyzer.analyze as any).mockReturnValue({ quadrant: "new" });

    const { result } = renderHook(() => useHierarchicalDistribution(mockPRs));

    const newQuadrant = result.current.hierarchicalData?.children.find(
      (q) => q.id === "new"
    );

    // Should have 20 individual contributors + 1 "Others" node
    expect(newQuadrant?.children).toHaveLength(21);

    const othersNode = newQuadrant?.children?.find((c) => c.login === "others");
    expect(othersNode).toBeDefined();
    expect(othersNode?.name).toBe("Others (5)");
    expect(othersNode?.value).toBe(5); // 5 remaining PRs
  });

  it("sorts contributors by PR count", async () => {
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );

    const mockPRs = [
      createMockPR(1, "user1"),
      createMockPR(2, "user2"),
      createMockPR(3, "user2"),
      createMockPR(4, "user2"),
      createMockPR(5, "user3"),
      createMockPR(6, "user3"),
    ];

    (ContributionAnalyzer.analyze as any).mockReturnValue({ quadrant: "new" });

    const { result } = renderHook(() => useHierarchicalDistribution(mockPRs));

    const newQuadrant = result.current.hierarchicalData?.children.find(
      (q) => q.id === "new"
    );

    const contributors = newQuadrant?.children || [];
    expect(contributors[0].login).toBe("user2"); // 3 PRs
    expect(contributors[1].login).toBe("user3"); // 2 PRs
    expect(contributors[2].login).toBe("user1"); // 1 PR
  });

  it("handles _errors in PR analysis gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "_error").mockImplementation(() => {});
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );

    const mockPRs = [
      createMockPR(1, "user1"),
      createMockPR(2, "user2"),
    ];

    (ContributionAnalyzer.analyze as any)
      .mockReturnValueOnce({ quadrant: "new" })
      .mockImplementationOnce(() => {
        throw new Error("Analysis failed");
      });

    const { result } = renderHook(() => useHierarchicalDistribution(mockPRs));

    // Error handling should be silent in production
    expect(consoleSpy).not.toHaveBeenCalled();

    // Should still process the successful PR
    const newQuadrant = result.current.hierarchicalData?.children.find(
      (q) => q.id === "new"
    );
    expect(newQuadrant?.value).toBe(1); // Only 1 PR processed successfully

    consoleSpy.mockRestore();
  });

  it("uses correct colors for quadrants", async () => {
    const mockPRs = [createMockPR(1, "user1")];
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );
    (ContributionAnalyzer.analyze as any).mockReturnValue({ quadrant: "new" });

    const { result } = renderHook(() => useHierarchicalDistribution(mockPRs));

    const quadrants = result.current.hierarchicalData?.children || [];
    
    expect(quadrants.find((q) => q.id === "refinement")?.color).toBe("#4ade80");
    expect(quadrants.find((q) => q.id === "new")?.color).toBe("#60a5fa");
    expect(quadrants.find((q) => q.id === "refactoring")?.color).toBe("#f97316");
    expect(quadrants.find((q) => q.id === "maintenance")?.color).toBe("#a78bfa");
  });

  it("includes empty quadrants in the structure", async () => {
    const mockPRs = [createMockPR(1, "user1")];
    const { ContributionAnalyzer } = vi.mocked(
      await import("@/lib/contribution-analyzer")
    );
    (ContributionAnalyzer.analyze as any).mockReturnValue({ quadrant: "new" });

    const { result } = renderHook(() => useHierarchicalDistribution(mockPRs));

    const quadrants = result.current.hierarchicalData?.children || [];
    expect(quadrants).toHaveLength(4); // All 4 quadrants should be present

    // Empty quadrants should have 0 value
    const maintenanceQuadrant = quadrants.find((q) => q.id === "maintenance");
    expect(maintenanceQuadrant?.value).toBe(0);
    expect(maintenanceQuadrant?.children).toHaveLength(0);
  });
});