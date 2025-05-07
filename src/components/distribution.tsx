import { useContext, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LanguageLegend } from "./language-legend";
import { QuadrantChart } from "./quadrant-chart";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import { getLanguageStats } from "@/lib/language-stats";
import type {
  PullRequest,
  QuadrantData as QuadrantDataType,
} from "@/lib/types";

export default function Distribution() {
  const { stats } = useContext(RepoStatsContext);
  const { timeRange } = useTimeRange();
  const timeRangeNumber = parseInt(timeRange, 10); // Parse string to number

  // Moved from use-distribution hook - Quadrant classification logic
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

  // Moved from use-distribution hook - Process data
  const { chartData, loading, quadrantCounts, totalContributions, dominantQuadrant } = useMemo(() => {
    if (!stats.pullRequests || stats.pullRequests.length === 0) {
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
    stats.pullRequests.forEach((pr) => {
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
  }, [stats.pullRequests]);

  // Functions moved from the hook
  const getTotalContributions = () => totalContributions;
  const getDominantQuadrant = () => dominantQuadrant;

  // Convert our data into the format expected by QuadrantChart
  const getQuadrantData = (): QuadrantDataType[] => {
    if (stats.pullRequests.length === 0) {
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
  const calculateTotalFiles = (prs: PullRequest[]): number => {
    if (prs.length === 0) return 0;

    return Math.min(
      500, // Cap to avoid unrealistic numbers
      Math.ceil(
        prs.reduce(
          (sum, pr) => sum + Math.ceil((pr.additions + pr.deletions) / 100),
          0
        )
      )
    );
  };

  // Get the statistics for display
  const languageStats = getLanguageStats(stats.pullRequests);
  const quadrantData = getQuadrantData();
  const totalFiles = calculateTotalFiles(stats.pullRequests);

  // Add language data to PRs (for visualization)
  const prepareDataForQuadrantChart = (prs: PullRequest[]) => {
    // Only process a limited number to avoid performance issues in the visualization
    const limitedPrs = prs.slice(0, 20);

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

  if (loading || stats.loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pull Request Distribution Analysis</CardTitle>
          <CardDescription>Loading distribution data...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle>Pull Request Distribution Analysis</CardTitle>
        <CardDescription>
          Visualize contribution patterns across different categories over the
          past {timeRangeNumber} days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 w-full overflow-visible">
        <div className="text-sm text-muted-foreground">
          {totalFiles.toLocaleString()} files touched · {totalContributions}{" "}
          pull requests analyzed
          {dominantQuadrant && ` · Primary focus: ${dominantQuadrant.label}`}
        </div>

        <LanguageLegend languages={languageStats} />
        <div className="overflow-visible">
          <QuadrantChart
            data={prepareDataForQuadrantChart(stats.pullRequests)}
            quadrants={quadrantData}
          />
        </div>
        <div className="text-sm text-muted-foreground mt-4">
          <p>
            This chart categorizes files touched into four quadrants based on
            the nature of changes:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <span className="font-medium">Refinement</span>: Code cleanup and
              removal
            </li>
            <li>
              <span className="font-medium">New Features</span>: New features
              and additions
            </li>
            <li>
              <span className="font-medium">Maintenance</span>: Configuration
              and dependencies
            </li>
            <li>
              <span className="font-medium">Refactoring</span>: Code
              improvements
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}