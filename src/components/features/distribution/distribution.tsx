import { useContext, useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PieChart, BarChart3, TreePine } from "lucide-react";
import { ShareableCard } from "@/components/features/sharing/shareable-card";
import { LanguageLegend } from "./language-legend";
import { LazyDistributionCharts } from "./distribution-charts-lazy";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { DistributionSkeleton } from "@/components/skeletons";
import { getLanguageStats } from "@/lib/language-stats";
import type { PullRequest } from "@/lib/types";
import { useDistribution } from "@/hooks/use-distribution";
import { ContributionAnalyzer } from "@/lib/contribution-analyzer";

export default function Distribution() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { stats } = useContext(RepoStatsContext);
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
      <CardContent className="space-y-6 w-full overflow-hidden pt-6">
        <Tabs value={chartType} onValueChange={(value) => handleChartTypeChange(value as "donut" | "bar" | "treemap")}>
          <div className="flex items-center justify-between mb-4 gap-4">
            {/* Statistics on the left */}
            <div className="text-sm text-muted-foreground">
              <div>{totalFiles.toLocaleString()} files touched</div>
              <div>
                {selectedQuadrant ? filteredPRs.length : totalContributions} merged pull
                requests {selectedQuadrant ? "shown" : "analyzed"}
                {dominantQuadrant && ` · Primary focus: ${dominantQuadrant.label}`}
              </div>
              {selectedQuadrant && (
                <div className="text-xs">
                  Filtered by: {chartData.find((q) => q.id === selectedQuadrant)?.label}
                </div>
              )}
            </div>

            {/* Tabs on the right */}
            <div>
              {/* Mobile: Only show donut and bar */}
              <div className="block sm:hidden">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="donut" className="text-sm flex items-center gap-1">
                    <PieChart className="h-4 w-4" />
                    <span className="hidden xs:inline">Donut</span>
                  </TabsTrigger>
                  <TabsTrigger value="bar" className="text-sm flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden xs:inline">Bar</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              {/* Desktop: Show all three */}
              <div className="hidden sm:block">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="donut" className="text-sm flex items-center gap-1">
                    <PieChart className="h-4 w-4" />
                    Donut
                  </TabsTrigger>
                  <TabsTrigger value="bar" className="text-sm flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    Bar
                  </TabsTrigger>
                  <TabsTrigger value="treemap" className="text-sm flex items-center gap-1">
                    <TreePine className="h-4 w-4" />
                    Treemap
                  </TabsTrigger>
                </TabsList>
              </div>
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
