import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { 
  RepoViewSkeleton, 
  ContributionsSkeleton, 
  DistributionSkeleton,
  ContributorOfMonthSkeleton,
  PRActivitySkeleton,
  ContributorCardSkeleton,
  ActivityItemSkeleton,
  SkeletonCard,
  SkeletonList,
  SkeletonChart
} from "../index";

describe("Skeleton Components", () => {
  describe("RepoViewSkeleton", () => {
    it("renders without crashing", () => {
      render(<RepoViewSkeleton />);
      expect(document.querySelector(".container")).toBeInTheDocument();
    });

    it("renders with custom className", () => {
      render(<RepoViewSkeleton className="test-class" />);
      expect(document.querySelector(".test-class")).toBeInTheDocument();
    });
  });

  describe("ContributionsSkeleton", () => {
    it("renders without crashing", () => {
      render(<ContributionsSkeleton />);
      // Check for presence of card structure
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("adapts layout for mobile", () => {
      render(<ContributionsSkeleton isMobile={true} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("DistributionSkeleton", () => {
    it("renders without crashing", () => {
      render(<DistributionSkeleton />);
      expect(document.querySelector(".overflow-visible")).toBeInTheDocument();
    });

    it("shows mobile placeholder when isMobile is true", () => {
      render(<DistributionSkeleton isMobile={true} />);
      expect(document.querySelector(".overflow-visible")).toBeInTheDocument();
    });
  });

  describe("Phase 2 Feature Skeletons", () => {
    it("ContributorOfMonthSkeleton renders winner phase", () => {
      render(<ContributorOfMonthSkeleton phase="winner" contributorCount={5} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
      expect(document.querySelector('[role="region"]')).toBeInTheDocument();
    });

    it("ContributorOfMonthSkeleton renders leaderboard phase", () => {
      render(<ContributorOfMonthSkeleton phase="leaderboard" contributorCount={3} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("PRActivitySkeleton renders with filters", () => {
      render(<PRActivitySkeleton showFilters={true} itemCount={5} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("PRActivitySkeleton renders without filters", () => {
      render(<PRActivitySkeleton showFilters={false} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Phase 2 Component Skeletons", () => {
    it("ContributorCardSkeleton renders with winner styling", () => {
      render(<ContributorCardSkeleton isWinner={true} showRank={false} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
      expect(document.querySelector(".ring-yellow-500")).toBeInTheDocument();
    });

    it("ContributorCardSkeleton renders with rank badge", () => {
      render(<ContributorCardSkeleton showRank={true} />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("ActivityItemSkeleton renders correctly", () => {
      render(<ActivityItemSkeleton />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
      // Should have avatar skeleton
      expect(document.querySelector(".rounded-full")).toBeInTheDocument();
    });
  });

  describe("Base Skeleton Components", () => {
    it("SkeletonCard renders correctly", () => {
      render(<SkeletonCard />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("SkeletonList renders correct number of items", () => {
      render(<SkeletonList itemCount={3} />);
      // Look for the list container and check its children
      const container = document.querySelector(".space-y-4") || document.querySelector(".space-y-2");
      const items = container?.children;
      expect(items?.length).toBe(3);
    });

    it("SkeletonChart renders different variants", () => {
      render(<SkeletonChart variant="scatter" />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });
});