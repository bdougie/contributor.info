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
      expect(document.querySelector(".overflow-hidden")).toBeInTheDocument();
    });

    it("shows mobile placeholder when isMobile is true", () => {
      render(<DistributionSkeleton isMobile={true} />);
      expect(document.querySelector(".overflow-hidden")).toBeInTheDocument();
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
      expect(document.querySelector(".skeleton-optimized")).toBeInTheDocument();
    });

    it("SkeletonCard has proper accessibility attributes", () => {
      render(<SkeletonCard />);
      const card = document.querySelector('[aria-label="Loading card content..."]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute("aria-busy", "true");
    });

    it("SkeletonList renders correct number of items", () => {
      render(<SkeletonList itemCount={3} />);
      // Look for the list container and check its children
      const container = document.querySelector(".space-y-4") || document.querySelector(".space-y-2");
      const items = container?.children;
      expect(items?.length).toBe(3);
    });

    it("SkeletonList has proper accessibility attributes", () => {
      render(<SkeletonList itemCount={2} />);
      const container = document.querySelector('[role="list"]');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute("aria-label", "Loading list items...");
      expect(container).toHaveAttribute("aria-busy", "true");
      
      const items = document.querySelectorAll('[role="listitem"]');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveAttribute("aria-label", "Loading item 1 of 2");
    });

    it("SkeletonList shows avatar when showAvatar is true", () => {
      render(<SkeletonList showAvatar={true} itemCount={1} />);
      expect(document.querySelector(".rounded-full")).toBeInTheDocument();
    });

    it("SkeletonList applies compact variant correctly", () => {
      render(<SkeletonList variant="compact" />);
      expect(document.querySelector(".space-y-2")).toBeInTheDocument();
      expect(document.querySelector(".p-2")).toBeInTheDocument();
    });

    it("SkeletonChart renders different variants", () => {
      render(<SkeletonChart variant="scatter" />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("SkeletonChart has proper accessibility attributes", () => {
      render(<SkeletonChart />);
      const container = document.querySelector('[role="img"]');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute("aria-label", "Loading chart...");
      expect(container).toHaveAttribute("aria-busy", "true");
    });

    it("SkeletonChart renders scatter variant with correct number of dots", () => {
      render(<SkeletonChart variant="scatter" />);
      // There should be 12 scatter dots based on CHART_CONFIG.SCATTER_DOTS
      const dots = document.querySelectorAll(".w-3.h-3.rounded-full");
      expect(dots.length).toBeGreaterThanOrEqual(12);
    });

    it("SkeletonChart renders bar variant with correct number of bars", () => {
      render(<SkeletonChart variant="bar" />);
      // There should be 8 bars based on CHART_CONFIG.BAR_COUNT
      const bars = document.querySelectorAll(".w-8");
      expect(bars.length).toBeGreaterThanOrEqual(8);
    });

    it("SkeletonChart renders with legend when showLegend is true", () => {
      render(<SkeletonChart showLegend={true} />);
      const legend = document.querySelector('[aria-label="Chart legend loading"]');
      expect(legend).toBeInTheDocument();
      // Should have 4 legend items based on CHART_CONFIG.LEGEND_ITEMS
      const legendItems = legend?.children;
      expect(legendItems?.length).toBe(4);
    });

    it("SkeletonChart renders axes when showAxes is true", () => {
      render(<SkeletonChart showAxes={true} />);
      // Y-axis should have 5 labels, X-axis should have 6 labels
      const yAxisLabels = document.querySelectorAll('[class*="w-8"][class*="h-3"]');
      const xAxisLabels = document.querySelectorAll('[class*="w-12"][class*="h-3"]');
      expect(yAxisLabels.length).toBeGreaterThanOrEqual(5);
      expect(xAxisLabels.length).toBeGreaterThanOrEqual(6);
    });

    it("SkeletonChart applies different height classes", () => {
      const { rerender } = render(<SkeletonChart height="sm" />);
      expect(document.querySelector(".h-48")).toBeInTheDocument();
      
      rerender(<SkeletonChart height="xl" />);
      expect(document.querySelector(".h-96")).toBeInTheDocument();
    });

    it("Skeleton components use performance-optimized CSS classes", () => {
      render(<SkeletonChart />);
      expect(document.querySelector(".skeleton-container")).toBeInTheDocument();
      expect(document.querySelector(".skeleton-optimized")).toBeInTheDocument();
    });

    it("SkeletonList items use optimized CSS classes", () => {
      render(<SkeletonList itemCount={1} />);
      expect(document.querySelector(".skeleton-container")).toBeInTheDocument();
      expect(document.querySelector(".skeleton-list-item")).toBeInTheDocument();
      expect(document.querySelector(".skeleton-optimized")).toBeInTheDocument();
    });
  });
});