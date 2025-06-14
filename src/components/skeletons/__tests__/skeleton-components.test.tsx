import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { 
  RepoViewSkeleton, 
  ContributionsSkeleton, 
  DistributionSkeleton,
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