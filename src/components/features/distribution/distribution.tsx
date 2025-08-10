import { useContext, useState, useEffect, Suspense, useMemo } from "react"
import { PieChart, BarChart3, TreePine } from '@/components/ui/icon';
import { useSearchParams, useParams } from "react-router-dom";
import { CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShareableCard } from "@/components/features/sharing/shareable-card";
import { LanguageLegend } from "./language-legend";
import { LazyDistributionCharts } from "./distribution-charts-lazy";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { DistributionSkeleton } from "@/components/skeletons";
import { getLanguageStats } from "@/lib/language-stats";
import type { PullRequest } from "@/lib/types";
import { useDistribution } from "@/hooks/use-distribution";
import { ContributionAnalyzer } from "@/lib/contribution-analyzer";
import { useNetworkAwareDetection } from "@/lib/utils";

export default function Distribution() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { stats } = useContext(RepoStatsContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(
    searchParams.get("filter") || null
  );
  
  // Use network-aware mobile detection for adaptive chart selection
  const { isMobile, shouldUseSimplifiedUI, isSlowConnection } = useNetworkAwareDetection();
  
  // Initialize chart type based on mobile/network conditions
  const getInitialChartType = (): "donut" | "bar" | "treemap" => {
    const chartFromUrl = searchParams.get("chart");
    const validChartTypes = ["donut", "bar", "treemap"];
    
    // Validate the chart type from URL
    if (chartFromUrl && validChartTypes.includes(chartFromUrl)) {
      const validChart = chartFromUrl as "donut" | "bar" | "treemap";
      if (shouldUseSimplifiedUI && validChart === "treemap") {
        return "donut"; // Fall back to donut for mobile/slow connections
      }
      return validChart;
    }
    
    // Default based on device/network capabilities
    return shouldUseSimplifiedUI ? "donut" : "treemap";
  };
  
  const [chartType, setChartType] = useState<"donut" | "bar" | "treemap">(getInitialChartType());

  // Sync selectedQuadrant and chartType with URL params
  useEffect(() => {
    const quadrantFromUrl = searchParams.get("filter");
    const chartFromUrl = searchParams.get("chart");
    
    // Validate chart type - only allow valid values
    const validChartTypes = ["donut", "bar", "treemap"];
    const validatedChartType = validChartTypes.includes(chartFromUrl as string) 
      ? chartFromUrl as "donut" | "bar" | "treemap"
      : "treemap"; // Default to treemap for invalid values
    
    setSelectedQuadrant(quadrantFromUrl);
    setChartType(validatedChartType);
  }, [searchParams]);

  // Adaptive chart type based on mobile/network conditions
  useEffect(() => {
    // Auto-adjust chart type for mobile/slow connections
    if (shouldUseSimplifiedUI && chartType === "treemap") {
      const newChartType = "donut";
      setChartType(newChartType);
      
      // Update URL to reflect the change
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("chart", newChartType);
      setSearchParams(newSearchParams, { replace: true }); // Use replace to avoid history pollution
    }
  }, [shouldUseSimplifiedUI, chartType, searchParams, setSearchParams]);

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
    // Prevent treemap selection on mobile/slow connections
    if (shouldUseSimplifiedUI && newChartType === "treemap") {
      console.log("Treemap chart not recommended for mobile/slow connections, using donut instead");
      newChartType = "donut";
    }
    
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

            {/* Tabs on the right - adaptive based on device capabilities */}
            <div>
              {/* Mobile/Slow Connection: Only show donut and bar */}
              {shouldUseSimplifiedUI ? (
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="donut" className="text-sm flex items-center gap-1">
                    <PieChart className="h-4 w-4" />
                    <span className={isMobile ? "hidden xs:inline" : ""}>Donut</span>
                  </TabsTrigger>
                  <TabsTrigger value="bar" className="text-sm flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    <span className={isMobile ? "hidden xs:inline" : ""}>Bar</span>
                  </TabsTrigger>
                </TabsList>
              ) : (
                /* Desktop/Fast Connection: Show all three */
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
              )}
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
            {/* Adaptive rendering based on device capabilities */}
            {shouldUseSimplifiedUI ? (
              /* Mobile/Slow Connection: Show donut instead of treemap */
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
            ) : (
              /* Desktop/Fast Connection: Show treemap */
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
            )}
          </TabsContent>
        </Tabs>

        <LanguageLegend languages={languageStats} />
      </CardContent>
    </ShareableCard>
  );
}
