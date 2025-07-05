import { useContext, useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import {
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShareableCard } from "@/components/features/sharing/shareable-card";
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
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { stats } = useContext(RepoStatsContext);
  const { timeRange } = useTimeRange();
  const timeRangeNumber = parseInt(timeRange, 10); // Parse string to number
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(
    searchParams.get("filter") || null
  );
  const [chartType, setChartType] = useState<"donut" | "bar" | "treemap">(
    (searchParams.get("chart") as "donut" | "bar" | "treemap") || "treemap"
  );

  // Sync selectedQuadrant and chartType with URL params
  useEffect(() => {
    const quadrantFromUrl = searchParams.get("filter");
    const chartFromUrl = searchParams.get("chart") as "donut" | "bar" | "treemap";
    setSelectedQuadrant(quadrantFromUrl);
    setChartType(chartFromUrl || "treemap");
  }, [searchParams]);

  // Handle mobile responsiveness for treemap
  useEffect(() => {
    const checkMobileAndAdjustChart = () => {
      const isMobile = window.innerWidth < 640;
      if (isMobile && chartType === "treemap") {
        // On mobile, switch to donut chart instead of treemap
        setChartType("donut");
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set("chart", "donut");
        setSearchParams(newSearchParams);
      }
    };

    checkMobileAndAdjustChart();
    window.addEventListener('resize', checkMobileAndAdjustChart);
    return () => window.removeEventListener('resize', checkMobileAndAdjustChart);
  }, [chartType, searchParams, setSearchParams]);

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

  const handleChartTypeChange = (newChartType: "donut" | "bar" | "treemap") => {
    setChartType(newChartType);
    
    // Update URL params
    const newSearchParams = new URLSearchParams(searchParams);
    if (newChartType !== "treemap") {
      newSearchParams.set("chart", newChartType);
    } else {
      newSearchParams.delete("chart"); // treemap is default
    }
    setSearchParams(newSearchParams);
  };

  if (loading || stats.loading) {
    return <DistributionSkeleton />;
  }

  return (
    <ShareableCard
      title="Merged Pull Request Distribution Analysis"
      className="overflow-hidden"
      contextInfo={{
        repository: owner && repo ? `${owner}/${repo}` : undefined,
        metric: "distribution analysis"
      }}
      chartType="distribution"
    >
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

        <Tabs value={chartType} onValueChange={(value) => handleChartTypeChange(value as "donut" | "bar" | "treemap")}>
          <div className="flex items-center justify-between mb-4">
            {/* Mobile: Only show donut and bar */}
            <div className="block sm:hidden">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="donut" className="text-sm">
                  Donut
                </TabsTrigger>
                <TabsTrigger value="bar" className="text-sm">
                  Bar
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Desktop: Show all three */}
            <div className="hidden sm:block">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="donut" className="text-sm">
                  Donut
                </TabsTrigger>
                <TabsTrigger value="bar" className="text-sm">
                  Bar
                </TabsTrigger>
                <TabsTrigger value="treemap" className="text-sm">
                  Treemap
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="donut" className="mt-0">
            <Suspense fallback={<DistributionSkeleton />}>
              <LazyDistributionCharts
                data={chartData}
                onSegmentClick={handleSegmentClick}
                filteredPRs={filteredPRs}
                selectedQuadrant={selectedQuadrant}
                pullRequests={mergedPullRequests}
                chartType="donut"
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="bar" className="mt-0">
            <Suspense fallback={<DistributionSkeleton />}>
              <LazyDistributionCharts
                data={chartData}
                onSegmentClick={handleSegmentClick}
                filteredPRs={filteredPRs}
                selectedQuadrant={selectedQuadrant}
                pullRequests={mergedPullRequests}
                chartType="bar"
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="treemap" className="mt-0">
            {/* Mobile: Show alternative chart */}
            <div className="block sm:hidden">
              <Suspense fallback={<DistributionSkeleton />}>
                <LazyDistributionCharts
                  data={chartData}
                  onSegmentClick={handleSegmentClick}
                  filteredPRs={filteredPRs}
                  selectedQuadrant={selectedQuadrant}
                  pullRequests={mergedPullRequests}
                  chartType="donut"
                />
              </Suspense>
            </div>
            
            {/* Desktop: Show treemap */}
            <div className="hidden sm:block">
              <Suspense fallback={<DistributionSkeleton />}>
                <LazyDistributionCharts
                  data={chartData}
                  onSegmentClick={handleSegmentClick}
                  filteredPRs={filteredPRs}
                  selectedQuadrant={selectedQuadrant}
                  pullRequests={mergedPullRequests}
                  chartType="treemap"
                />
              </Suspense>
            </div>
          </TabsContent>
        </Tabs>

        <LanguageLegend languages={languageStats} />
      </CardContent>
    </ShareableCard>
  );
}
