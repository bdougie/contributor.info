import { useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, UserCheck, TrendingUp } from "lucide-react";
import { ShareableCapturePreview } from "./shareable-capture-preview";
import { LotteryFactorContent } from "@/components/features/health/lottery-factor";
import { DistributionCharts } from "@/components/features/distribution/distribution-charts";
import { RepositoryHealthFactors } from "@/components/insights/sections/repository-health-factors";
import { ShareableCard } from "@/components/features/sharing/shareable-card";
import { ContributorOfTheMonth } from "@/components/features/contributor/contributor-of-the-month";
import { ContributorCard } from "@/components/features/contributor/contributor-card";
import type { RepoStats, LotteryFactor, ContributorRanking, MonthlyContributor } from "@/lib/types";
import type { QuadrantData } from "@/hooks/use-distribution";

// Mock data for testing
const mockRepoStats: RepoStats = {
  pullRequests: [
    {
      id: 1,
      number: 1,
      title: "Add new authentication system",
      user: { id: 1, login: "alice-dev", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4", type: "User" },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      merged_at: "2024-01-02T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 450,
      deletions: 80
    },
    {
      id: 2,
      number: 2,
      title: "Fix critical security vulnerability",
      user: { id: 1, login: "alice-dev", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4", type: "User" },
      created_at: "2024-01-03T00:00:00Z",
      updated_at: "2024-01-04T00:00:00Z",
      merged_at: "2024-01-04T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 120,
      deletions: 45
    },
    {
      id: 3,
      number: 3,
      title: "Implement user dashboard",
      user: { id: 2, login: "bob-maintainer", avatar_url: "https://avatars.githubusercontent.com/u/2?v=4", type: "User" },
      created_at: "2024-01-05T00:00:00Z",
      updated_at: "2024-01-06T00:00:00Z",
      merged_at: "2024-01-06T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 320,
      deletions: 25
    },
    {
      id: 4,
      number: 4,
      title: "Add unit tests for core modules",
      user: { id: 3, login: "charlie-qa", avatar_url: "https://avatars.githubusercontent.com/u/3?v=4", type: "User" },
      created_at: "2024-01-07T00:00:00Z",
      updated_at: "2024-01-08T00:00:00Z",
      merged_at: "2024-01-08T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 280,
      deletions: 15
    },
    {
      id: 5,
      number: 5,
      title: "Refactor database layer",
      user: { id: 2, login: "bob-maintainer", avatar_url: "https://avatars.githubusercontent.com/u/2?v=4", type: "User" },
      created_at: "2024-01-09T00:00:00Z",
      updated_at: "2024-01-10T00:00:00Z",
      merged_at: "2024-01-10T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 180,
      deletions: 220
    },
    {
      id: 6,
      number: 6,
      title: "Update documentation",
      user: { id: 4, login: "diana-docs", avatar_url: "https://avatars.githubusercontent.com/u/4?v=4", type: "User" },
      created_at: "2024-01-11T00:00:00Z",
      updated_at: "2024-01-12T00:00:00Z",
      merged_at: "2024-01-12T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 95,
      deletions: 30
    },
    {
      id: 7,
      number: 7,
      title: "Optimize performance bottlenecks",
      user: { id: 1, login: "alice-dev", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4", type: "User" },
      created_at: "2024-01-13T00:00:00Z",
      updated_at: "2024-01-14T00:00:00Z",
      merged_at: "2024-01-14T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 150,
      deletions: 75
    },
    {
      id: 8,
      number: 8,
      title: "Add API rate limiting",
      user: { id: 5, login: "eve-backend", avatar_url: "https://avatars.githubusercontent.com/u/5?v=4", type: "User" },
      created_at: "2024-01-15T00:00:00Z",
      updated_at: "2024-01-16T00:00:00Z",
      merged_at: "2024-01-16T00:00:00Z",
      repository_owner: "test-org",
      repository_name: "awesome-project",
      state: "closed",
      additions: 85,
      deletions: 12
    }
  ],
  loading: false,
  error: null
};

const mockLotteryFactor: LotteryFactor = {
  topContributorsCount: 2,
  topContributorsPercentage: 68,
  riskLevel: "High" as const,
  totalContributors: 5,
  contributors: [
    {
      login: "alice-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      pullRequests: 4,
      percentage: 50
    },
    {
      login: "bob-maintainer", 
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
      pullRequests: 2,
      percentage: 25
    },
    {
      login: "charlie-qa",
      avatar_url: "https://avatars.githubusercontent.com/u/3?v=4", 
      pullRequests: 1,
      percentage: 12.5
    },
    {
      login: "diana-docs",
      avatar_url: "https://avatars.githubusercontent.com/u/4?v=4", 
      pullRequests: 1,
      percentage: 12.5
    }
  ]
};



const mockQuadrantData: QuadrantData[] = [
  {
    id: "refinement",
    label: "Refinement",
    value: 35,
    percentage: 35,
    color: "#4ade80",
    description: "Small, focused improvements and optimizations"
  },
  {
    id: "new",
    label: "New Features", 
    value: 28,
    percentage: 28,
    color: "#60a5fa",
    description: "Brand new functionality and capabilities"
  },
  {
    id: "refactoring",
    label: "Refactoring",
    value: 22,
    percentage: 22,
    color: "#f97316", 
    description: "Code restructuring and architecture improvements"
  },
  {
    id: "maintenance",
    label: "Maintenance",
    value: 15,
    percentage: 15,
    color: "#a78bfa",
    description: "Bug fixes, security updates, and dependency management"
  }
];

// Mock self-selection data
const mockSelfSelectionStats = {
  external_contribution_rate: 35.7,
  internal_contribution_rate: 64.3,
  external_contributors: 8,
  internal_contributors: 3,
  total_contributors: 11,
  external_prs: 15,
  internal_prs: 27,
  total_prs: 42,
  analysis_period_days: 30
};

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

// Mock contributor of the month data
const mockMonthlyContributors: MonthlyContributor[] = [
  {
    login: "alice-dev",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    activity: {
      pullRequests: 8,
      reviews: 12,
      comments: 15,
      totalScore: 47,
      firstContributionDate: "2024-01-03T00:00:00Z"
    },
    rank: 1,
    isWinner: true
  },
  {
    login: "bob-maintainer",
    avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
    activity: {
      pullRequests: 5,
      reviews: 8,
      comments: 12,
      totalScore: 41,
      firstContributionDate: "2024-01-01T00:00:00Z"
    },
    rank: 2
  },
  {
    login: "charlie-qa",
    avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
    activity: {
      pullRequests: 6,
      reviews: 4,
      comments: 8,
      totalScore: 30,
      firstContributionDate: "2024-01-05T00:00:00Z"
    },
    rank: 3
  },
  {
    login: "diana-docs",
    avatar_url: "https://avatars.githubusercontent.com/u/4?v=4",
    activity: {
      pullRequests: 3,
      reviews: 6,
      comments: 5,
      totalScore: 36,
      firstContributionDate: "2024-01-07T00:00:00Z"
    },
    rank: 4
  },
  {
    login: "eve-backend",
    avatar_url: "https://avatars.githubusercontent.com/u/5?v=4",
    activity: {
      pullRequests: 4,
      reviews: 3,
      comments: 7,
      totalScore: 34,
      firstContributionDate: "2024-01-12T00:00:00Z"
    },
    rank: 5
  },
  {
    login: "frank-frontend",
    avatar_url: "https://avatars.githubusercontent.com/u/6?v=4",
    activity: {
      pullRequests: 2,
      reviews: 5,
      comments: 6,
      totalScore: 33,
      firstContributionDate: "2024-01-08T00:00:00Z"
    },
    rank: 6
  },
  {
    login: "grace-designer",
    avatar_url: "https://avatars.githubusercontent.com/u/7?v=4",
    activity: {
      pullRequests: 3,
      reviews: 2,
      comments: 8,
      totalScore: 29,
      firstContributionDate: "2024-01-15T00:00:00Z"
    },
    rank: 7
  },
  {
    login: "henry-intern",
    avatar_url: "https://avatars.githubusercontent.com/u/8?v=4",
    activity: {
      pullRequests: 1,
      reviews: 3,
      comments: 4,
      totalScore: 22,
      firstContributionDate: "2024-01-20T00:00:00Z"
    },
    rank: 8
  }
];

const mockContributorRankingWinner: ContributorRanking = {
  month: "January",
  year: 2024,
  contributors: mockMonthlyContributors,
  winner: mockMonthlyContributors[0],
  phase: "winner_announcement"
};

const mockContributorRankingLeaderboard: ContributorRanking = {
  month: "February",
  year: 2024,
  contributors: mockMonthlyContributors.map(c => ({ ...c, isWinner: false })),
  phase: "running_leaderboard"
};

const chartTypes = [
  { id: "lottery-factor", label: "Lottery Factor", description: "Repository risk analysis" },
  { id: "self-selection", label: "Self-Selection Rate", description: "External vs internal contribution rate" },
  { id: "health-factors", label: "Health Factors", description: "Repository health metrics" },
  { id: "contributor-winner", label: "Contributor Winner", description: "Monthly contributor winner announcement" },
  { id: "contributor-leaderboard", label: "Contributor Leaderboard", description: "Current monthly contributor leaderboard" },
  { id: "distribution-pie", label: "Distribution Pie Chart", description: "Contribution distribution" },
  { id: "distribution-bar", label: "Distribution Bar Chart", description: "Contribution metrics" },
  { id: "distribution-treemap", label: "Distribution Treemap", description: "Hierarchical view" }
];

export function ShareableChartsPreview() {
  const [selectedChart, setSelectedChart] = useState("lottery-factor");

  const renderChart = () => {
    const repository = "test-org/awesome-project";
    const [owner, repo] = repository.split("/");

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
            <DistributionCharts
              data={mockQuadrantData}
              pullRequests={mockRepoStats.pullRequests}
              chartType="donut"
            />
          </ShareableCapturePreview>
        );

      case "distribution-bar":
        return (
          <ShareableCapturePreview repository={repository}>
            <DistributionCharts
              data={mockQuadrantData}
              pullRequests={mockRepoStats.pullRequests}
              chartType="bar"
            />
          </ShareableCapturePreview>
        );

      case "distribution-treemap":
        return (
          <ShareableCapturePreview repository={repository}>
            <DistributionCharts
              data={mockQuadrantData}
              pullRequests={mockRepoStats.pullRequests}
              chartType="treemap"
            />
          </ShareableCapturePreview>
        );

      default:
        return <div>Chart not found</div>;
    }
  };

  const selectedChartInfo = chartTypes.find(c => c.id === selectedChart);

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
          <CardTitle>Capture Preview</CardTitle>
          <p className="text-sm text-muted-foreground">
            This shows exactly what will be captured when sharing/downloading - white background with orange border and black attribution header
          </p>
        </CardHeader>
        <CardContent className="min-h-[400px] p-8 bg-muted/50">
          {renderChart()}
        </CardContent>
      </Card>
    </div>
  );
}