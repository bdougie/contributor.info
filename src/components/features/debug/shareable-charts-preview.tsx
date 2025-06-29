import { useState, memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, UserCheck, TrendingUp } from "lucide-react";
import { ShareableCapturePreview } from "./shareable-capture-preview";
import { LotteryFactorContent } from "@/components/features/health/lottery-factor";
import { LazyDistributionCharts } from "@/components/features/distribution/distribution-charts-lazy";
import { RepositoryHealthFactors } from "@/components/insights/sections/repository-health-factors";
import { ShareableCard } from "@/components/features/sharing/shareable-card";
import { ContributorOfTheMonth } from "@/components/features/contributor/contributor-of-the-month";
import { ContributorCard } from "@/components/features/contributor/contributor-card";
import type { ContributorRanking } from "@/lib/types";
import {
  mockRepoStats,
  mockLotteryFactor,
  mockQuadrantData,
  mockSelfSelectionStats,
  mockContributorRankingWinner,
  mockContributorRankingLeaderboard
} from "./mock-data";


// Mock Self-Selection Rate component for testing
const MockSelfSelectionRate = memo(function MockSelfSelectionRate({ owner, repo, daysBack }: { owner: string; repo: string; daysBack: number }) {
  const stats = mockSelfSelectionStats;
  
  return (
    <ShareableCard
      title="Self-Selection Rate"
      contextInfo={{
        repository: `${owner}/${repo}`,
        metric: "self-selection rate"
      }}
      chartType="self-selection"
    >
      <Card>
        <CardHeader>
          <CardTitle>Self-Selection Rate</CardTitle>
          <CardDescription>
            External vs internal contributions over the last {daysBack} days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main metric */}
          <div className="text-center">
            <div className="text-4xl font-bold">
              {stats.external_contribution_rate.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              of contributions from external contributors
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>External</span>
              <span>Internal</span>
            </div>
            <Progress 
              value={stats.external_contribution_rate} 
              className="h-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.external_prs} PRs</span>
              <span>{stats.internal_prs} PRs</span>
            </div>
          </div>

          {/* Contributor breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">External</span>
              </div>
              <div className="text-2xl font-semibold">
                {stats.external_contributors}
              </div>
              <p className="text-xs text-muted-foreground">
                contributors
              </p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Internal</span>
              </div>
              <div className="text-2xl font-semibold">
                {stats.internal_contributors}
              </div>
              <p className="text-xs text-muted-foreground">
                maintainers/owners
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total PRs</span>
              <span className="font-medium">{stats.total_prs}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Total Contributors</span>
              <span className="font-medium">{stats.total_contributors}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </ShareableCard>
  );
});

// Custom Stacked Contributor Leaderboard for better full-width display
const StackedContributorLeaderboard = memo(function StackedContributorLeaderboard({ ranking }: { ranking: ContributorRanking }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Monthly Leaderboard</CardTitle>
            <CardDescription>
              Top contributors for {ranking.month} {ranking.year}
            </CardDescription>
          </div>
          <Badge variant="secondary">Current</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {ranking.contributors.length} active contributor{ranking.contributors.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Stacked contributor cards - full width */}
        <div className="space-y-3">
          {ranking.contributors.map((contributor) => (
            <ContributorCard 
              key={contributor.login}
              contributor={contributor} 
              showRank={true}
              className="w-full"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});


export function ShareableChartsPreview() {
  const [selectedChart, setSelectedChart] = useState("lottery-factor");
  
  // Memoize chart types to prevent recreation on every render
  const chartTypes = useMemo(() => [
    { id: "lottery-factor", label: "Lottery Factor", description: "Repository risk analysis" },
    { id: "self-selection", label: "Self-Selection Rate", description: "External vs internal contribution rate" },
    { id: "health-factors", label: "Health Factors", description: "Repository health metrics" },
    { id: "contributor-winner", label: "Contributor Winner", description: "Monthly contributor winner announcement" },
    { id: "contributor-leaderboard", label: "Contributor Leaderboard", description: "Current monthly contributor leaderboard" },
    { id: "distribution-pie", label: "Distribution Pie Chart", description: "Contribution distribution" },
    { id: "distribution-bar", label: "Distribution Bar Chart", description: "Contribution metrics" },
    { id: "distribution-treemap", label: "Distribution Treemap", description: "Hierarchical view" }
  ], []);

  // Memoize repository data
  const repository = useMemo(() => "test-org/awesome-project", []);
  const [owner, repo] = useMemo(() => repository.split("/"), [repository]);
  
  // Memoize selected chart info
  const selectedChartInfo = useMemo(() => 
    chartTypes.find(c => c.id === selectedChart), 
    [chartTypes, selectedChart]
  );

  const renderChart = useMemo(() => {

    switch (selectedChart) {
      case "lottery-factor":
        return (
          <ShareableCapturePreview repository={repository}>
            <LotteryFactorContent
              stats={mockRepoStats}
              lotteryFactor={mockLotteryFactor}
              showYoloButton={false}
              includeBots={false}
            />
          </ShareableCapturePreview>
        );

      case "self-selection":
        return (
          <ShareableCapturePreview repository={repository}>
            <MockSelfSelectionRate
              owner={owner}
              repo={repo}
              daysBack={30}
            />
          </ShareableCapturePreview>
        );

      case "health-factors":
        return (
          <ShareableCapturePreview repository={repository}>
            <RepositoryHealthFactors
              stats={mockRepoStats}
              timeRange="30"
              repositoryName={repository}
            />
          </ShareableCapturePreview>
        );

      case "contributor-winner":
        return (
          <ShareableCapturePreview repository={repository}>
            <ContributorOfTheMonth
              ranking={mockContributorRankingWinner}
              loading={false}
              error={null}
            />
          </ShareableCapturePreview>
        );

      case "contributor-leaderboard":
        return (
          <ShareableCapturePreview repository={repository}>
            <StackedContributorLeaderboard
              ranking={mockContributorRankingLeaderboard}
            />
          </ShareableCapturePreview>
        );

      case "distribution-pie":
        return (
          <ShareableCapturePreview repository={repository}>
            <ShareableCard
              title="Distribution Pie Chart"
              contextInfo={{
                repository: repository,
                metric: "distribution pie chart"
              }}
              chartType="distribution-pie"
              bypassAnalytics={true}
            >
              <LazyDistributionCharts
                data={mockQuadrantData}
                pullRequests={mockRepoStats.pullRequests}
                chartType="donut"
              />
            </ShareableCard>
          </ShareableCapturePreview>
        );

      case "distribution-bar":
        return (
          <ShareableCapturePreview repository={repository}>
            <ShareableCard
              title="Distribution Bar Chart"
              contextInfo={{
                repository: repository,
                metric: "distribution bar chart"
              }}
              chartType="distribution-bar"
              bypassAnalytics={true}
            >
              <LazyDistributionCharts
                data={mockQuadrantData}
                pullRequests={mockRepoStats.pullRequests}
                chartType="bar"
              />
            </ShareableCard>
          </ShareableCapturePreview>
        );

      case "distribution-treemap":
        return (
          <ShareableCapturePreview repository={repository}>
            <ShareableCard
              title="Distribution Treemap"
              contextInfo={{
                repository: repository,
                metric: "distribution treemap"
              }}
              chartType="distribution-treemap"
              bypassAnalytics={true}
            >
              <LazyDistributionCharts
                data={mockQuadrantData}
                pullRequests={mockRepoStats.pullRequests}
                chartType="treemap"
              />
            </ShareableCard>
          </ShareableCapturePreview>
        );

      default:
        return <div>Chart not found</div>;
    }
  }, [selectedChart, owner, repo, repository]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Shareable Charts Preview
            <Badge variant="outline">Testing Mode</Badge>
          </CardTitle>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Select Chart Type
              </label>
              <Select value={selectedChart} onValueChange={setSelectedChart}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Choose a chart type">
                    {chartTypes.find(c => c.id === selectedChart)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {chartTypes.map((chart) => (
                    <SelectItem key={chart.id} value={chart.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{chart.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {chart.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedChartInfo && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Testing:</span> {selectedChartInfo.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedChartInfo.description} • Analytics bypassed • Mock data used
                </p>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chart Preview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Preview of shareable charts with attribution bar - matching main page appearance (orange border only appears during capture)
          </p>
        </CardHeader>
        <CardContent className="min-h-[400px] p-8 bg-muted/50">
          {renderChart}
        </CardContent>
      </Card>
    </div>
  );
}