import { useMemo } from "react";
import { getLanguageStats } from "@/lib/language-stats";
import type { PullRequest, QuadrantData } from "@/lib/types";

export function useDistribution(pullRequests: PullRequest[]) {
  // Quadrant classification logic
  const classifyPullRequest = (pr: PullRequest) => {
    const ratio = pr.additions === 0 ? 0 : pr.deletions / pr.additions;
    
    if (ratio > 1.5) {
      return "refinement"; // More deletions than additions
    } else if (ratio < 0.2) {
      return "newStuff"; // Primarily additions
    } else if (pr.patch && pr.patch.includes("package.json")) {
      return "maintenance"; // Changes to dependencies
    } else {
      return "refactoring"; // Balanced changes
    }
  };

  // Process data for chart
  const { chartData, loading, quadrantCounts, totalContributions, dominantQuadrant } = useMemo(() => {
    if (!pullRequests || pullRequests.length === 0) {
      return {
        chartData: [
          { id: "refinement", label: "Refinement", percentage: 25 },
          { id: "newStuff", label: "New Features", percentage: 25 },
          { id: "maintenance", label: "Maintenance", percentage: 25 },
          { id: "refactoring", label: "Refactoring", percentage: 25 },
        ],
        loading: false,
        quadrantCounts: {
          refinement: 0,
          newStuff: 0,
          maintenance: 0,
          refactoring: 0,
        },
        totalContributions: 0,
        dominantQuadrant: null
      };
    }

    const counts = {
      refinement: 0,
      newStuff: 0,
      maintenance: 0,
      refactoring: 0,
    };

    // Classify each PR
    pullRequests.forEach((pr) => {
      const quadrant = classifyPullRequest(pr);
      counts[quadrant as keyof typeof counts]++;
    });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    // Calculate percentages for each quadrant
    const data = [
      { 
        id: "refinement", 
        label: "Refinement",
        percentage: Math.round((counts.refinement / total) * 100) || 0 
      },
      { 
        id: "newStuff", 
        label: "New Features",
        percentage: Math.round((counts.newStuff / total) * 100) || 0 
      },
      { 
        id: "maintenance", 
        label: "Maintenance",
        percentage: Math.round((counts.maintenance / total) * 100) || 0 
      },
      { 
        id: "refactoring", 
        label: "Refactoring",
        percentage: Math.round((counts.refactoring / total) * 100) || 0 
      },
    ];

    // Find the dominant quadrant
    const dominant = data.reduce((max, current) => 
      current.percentage > max.percentage ? current : max, 
      data[0]
    );

    return {
      chartData: data,
      loading: false,
      quadrantCounts: counts,
      totalContributions: total,
      dominantQuadrant: dominant
    };
  }, [pullRequests]);

  // Get quadrant data formatted for the chart component
  const getQuadrantData = (): QuadrantData[] => {
    if (!pullRequests || pullRequests.length === 0) {
      return [
        {
          name: "Refinement",
          authors: [],
          percentage: 25,
          count: 0,
        },
        {
          name: "New Stuff", // This is the name expected by the chart
          authors: [],
          percentage: 25,
          count: 0,
        },
        {
          name: "Maintenance",
          authors: [],
          percentage: 25,
          count: 0,
        },
        {
          name: "Refactoring",
          authors: [],
          percentage: 25,
          count: 0,
        },
      ];
    }

    // Create an array that maps the quadrants to the format expected by QuadrantChart
    // with the correct counts from our calculated data
    return [
      {
        name: "Refinement",
        authors: [],
        percentage:
          chartData.find((q) => q.id === "refinement")?.percentage || 0,
        count: quadrantCounts.refinement,
      },
      {
        name: "New Stuff", // This is the name expected by the chart
        authors: [],
        percentage: chartData.find((q) => q.id === "newStuff")?.percentage || 0,
        count: quadrantCounts.newStuff,
      },
      {
        name: "Maintenance",
        authors: [],
        percentage:
          chartData.find((q) => q.id === "maintenance")?.percentage || 0,
        count: quadrantCounts.maintenance,
      },
      {
        name: "Refactoring",
        authors: [],
        percentage:
          chartData.find((q) => q.id === "refactoring")?.percentage || 0,
        count: quadrantCounts.refactoring,
      },
    ];
  };

  // Calculate total files touched (approximate based on additions/deletions)
  const calculateTotalFiles = (): number => {
    if (!pullRequests || pullRequests.length === 0) return 0;

    return Math.min(
      500, // Cap to avoid unrealistic numbers
      Math.ceil(
        pullRequests.reduce(
          (sum, pr) => sum + Math.ceil((pr.additions + pr.deletions) / 100),
          0
        )
      )
    );
  };

  // Prepare data for quadrant chart visualization
  const prepareDataForQuadrantChart = () => {
    if (!pullRequests || pullRequests.length === 0) return [];
    
    // Only process a limited number to avoid performance issues in the visualization
    const limitedPrs = pullRequests.slice(0, 20);

    return limitedPrs.map((pr) => ({
      ...pr,
      // If the PR already has commit data, use it
      commits: pr.commits || [
        // Otherwise create synthetic commit data based on the PR's additions/deletions
        {
          additions: pr.additions * 0.6,
          deletions: pr.deletions * 0.6,
          language: "TypeScript",
        },
        {
          additions: pr.additions * 0.3,
          deletions: pr.deletions * 0.3,
          language: "JavaScript",
        },
        {
          additions: pr.additions * 0.1,
          deletions: pr.deletions * 0.1,
          language: "CSS",
        },
      ],
      // Additional fields needed by QuadrantChart
      url: `https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`,
      author: {
        login: pr.user.login,
        id: pr.user.id,
      },
      createdAt: pr.created_at,
    }));
  };

  // Get the statistics for display
  const languageStats = getLanguageStats(pullRequests);
  const quadrantData = getQuadrantData();
  const totalFiles = calculateTotalFiles();
  const preparedChartData = prepareDataForQuadrantChart();

  return {
    loading,
    totalContributions,
    totalFiles,
    dominantQuadrant,
    quadrantData,
    languageStats,
    preparedChartData
  };
}