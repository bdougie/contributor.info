import { useContext, useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LanguageLegend } from "./language-legend";
import { LazyDistributionCharts } from "./distribution-charts-lazy";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import { DistributionSkeleton } from "@/components/skeletons";
import { getLanguageStats } from "@/lib/language-stats";
import type { PullRequest } from "@/lib/types";
import { useDistribution } from "@/hooks/use-distribution";
import { ContributionAnalyzer } from "@/lib/contribution-analyzer";

export default function Distribution() {
  const { stats } = useContext(RepoStatsContext);
  const { timeRange } = useTimeRange();
  const timeRangeNumber = parseInt(timeRange, 10); // Parse string to number
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(
    searchParams.get("filter") || null
  );

  // Sync selectedQuadrant with URL params
  useEffect(() => {
    const quadrantFromUrl = searchParams.get("filter");
    setSelectedQuadrant(quadrantFromUrl);
  }, [searchParams]);

  // Filter to only include merged PRs and memoize to prevent infinite re-renders
  const mergedPullRequests = useMemo(() => 
    stats.pullRequests.filter(pr => pr.merged_at !== null), 
    [stats.pullRequests]
  );

  // Use our hook with merged PRs only
  const { chartData, loading, getDominantQuadrant, getTotalContributions } =
    useDistribution(mergedPullRequests);

  // Filter PRs based on selected quadrant - memoized
  const filteredPRs = useMemo(() => {
    if (!selectedQuadrant) return mergedPullRequests;
    
    return mergedPullRequests.filter((pr) => {
      try {
        // Use the analyzer to determine which quadrant this PR belongs to
        const metrics = ContributionAnalyzer.analyze(pr);
        return metrics.quadrant === selectedQuadrant;
      } catch (error) {
        console.error("Error analyzing PR:", pr.number, error);
        return false;
      }
    });
  }, [mergedPullRequests, selectedQuadrant]);

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
  const languageStats = getLanguageStats(filteredPRs);
  const totalFiles = calculateTotalFiles(filteredPRs);
  const totalContributions = getTotalContributions();
  const dominantQuadrant = getDominantQuadrant();

  const handleSegmentClick = (quadrantId: string) => {
    const newQuadrant = selectedQuadrant === quadrantId ? null : quadrantId;
    setSelectedQuadrant(newQuadrant);

    // Update URL params
    const newSearchParams = new URLSearchParams(searchParams);
    if (newQuadrant) {
      newSearchParams.set("filter", newQuadrant);
    } else {
      newSearchParams.delete("filter");
    }
    setSearchParams(newSearchParams);
  };

  if (loading || stats.loading) {
    return <DistributionSkeleton />;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Merged Pull Request Distribution Analysis</CardTitle>
        <CardDescription>
          Visualize merged contribution patterns across different categories over the
          past {timeRangeNumber} days
          {selectedQuadrant &&
            ` · Filtered by: ${
              chartData.find((q) => q.id === selectedQuadrant)?.label
            }`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 w-full overflow-hidden">
        <div className="text-sm text-muted-foreground">
          {totalFiles.toLocaleString()} files touched ·{" "}
          {selectedQuadrant ? filteredPRs.length : totalContributions} merged pull
          requests {selectedQuadrant ? "shown" : "analyzed"}
          {dominantQuadrant && ` · Primary focus: ${dominantQuadrant.label}`}
        </div>

        <Suspense fallback={<DistributionSkeleton />}>
          <LazyDistributionCharts
            data={chartData}
            onSegmentClick={handleSegmentClick}
            filteredPRs={filteredPRs}
            selectedQuadrant={selectedQuadrant}
            pullRequests={mergedPullRequests}
          />
        </Suspense>

        <LanguageLegend languages={languageStats} />
      </CardContent>
    </Card>
  );
}
