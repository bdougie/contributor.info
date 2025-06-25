import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShareableCapturePreview } from "./shareable-capture-preview";
import { LotteryFactorContent } from "@/components/features/health/lottery-factor";
import { DistributionCharts } from "@/components/features/distribution/distribution-charts";
import type { RepoStats, LotteryFactor } from "@/lib/types";
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


const chartTypes = [
  { id: "lottery-factor", label: "Lottery Factor", description: "Repository risk analysis" },
  { id: "distribution-pie", label: "Distribution Pie Chart", description: "Contribution distribution" },
  { id: "distribution-bar", label: "Distribution Bar Chart", description: "Contribution metrics" },
  { id: "distribution-treemap", label: "Distribution Treemap", description: "Hierarchical view" }
];

export function ShareableChartsPreview() {
  const [selectedChart, setSelectedChart] = useState("lottery-factor");

  const renderChart = () => {
    const repository = "test-org/awesome-project";

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
                  <SelectValue placeholder="Choose a chart type" />
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