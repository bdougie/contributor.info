import { useContext } from "react";
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
import { useDistribution } from "@/hooks/use-distribution";
export default function Distribution() {
  const { stats } = useContext(RepoStatsContext);
  const { timeRange } = useTimeRange();
  const timeRangeNumber = parseInt(timeRange, 10); // Parse string to number

  const {
    loading,
    totalContributions,
    totalFiles,
    dominantQuadrant,
    quadrantData,
    languageStats,
    preparedChartData
  } = useDistribution(stats.pullRequests);
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
            data={preparedChartData}
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