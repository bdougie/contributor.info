import { useContext, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { LanguageLegend } from "./language-legend";
import { DistributionCharts } from "./distribution-charts";
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
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);

  // Use our hook
  const {
    chartData,
    loading,
    getDominantQuadrant,
    getTotalContributions,
  } = useDistribution(stats.pullRequests);

  // Filter PRs based on selected quadrant
  const filteredPRs = selectedQuadrant 
    ? stats.pullRequests.filter(pr => {
        try {
          // Use the analyzer to determine which quadrant this PR belongs to
          const metrics = ContributionAnalyzer.analyze(pr);
          return metrics.quadrant === selectedQuadrant;
        } catch (error) {
          console.error('Error analyzing PR:', pr.number, error);
          return false;
        }
      })
    : stats.pullRequests;

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
    setSelectedQuadrant(selectedQuadrant === quadrantId ? null : quadrantId);
  };


  if (loading || stats.loading) {
    return <DistributionSkeleton />;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Pull Request Distribution Analysis</CardTitle>
        <CardDescription>
          Visualize contribution patterns across different categories over the
          past {timeRangeNumber} days
          {selectedQuadrant && ` · Filtered by: ${chartData.find(q => q.id === selectedQuadrant)?.label}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 w-full overflow-hidden">
        <div className="text-sm text-muted-foreground">
          {totalFiles.toLocaleString()} files touched · {selectedQuadrant ? filteredPRs.length : totalContributions}{" "}
          pull requests {selectedQuadrant ? 'shown' : 'analyzed'}
          {dominantQuadrant && ` · Primary focus: ${dominantQuadrant.label}`}
        </div>

        <DistributionCharts 
          data={chartData} 
          onSegmentClick={handleSegmentClick}
          filteredPRs={filteredPRs}
          selectedQuadrant={selectedQuadrant}
          pullRequests={stats.pullRequests}
        />

        <LanguageLegend languages={languageStats} />
        
        <div className="text-sm text-muted-foreground mt-4">
          <p>
            This chart categorizes pull requests into four categories based on
            the nature of changes:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <span className="font-medium">Refinement</span>: Code cleanup and
              removal (more deletions than additions)
            </li>
            <li>
              <span className="font-medium">New Features</span>: New features
              and additions (significantly more additions)
            </li>
            <li>
              <span className="font-medium">Maintenance</span>: Configuration,
              documentation, and dependencies
            </li>
            <li>
              <span className="font-medium">Refactoring</span>: Code
              improvements (balanced additions and deletions)
            </li>
          </ul>
          {selectedQuadrant && (
            <p className="mt-3 text-sm text-blue-600 dark:text-blue-400">
              Click to unapply filter
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
