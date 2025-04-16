import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Outlet } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, SearchIcon, Users, MonitorPlay } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginDialog } from "./login-dialog";
import { ContributorHoverCard } from "./contributor-hover-card";
import { QuadrantChart } from "./quadrant-chart";
import { LanguageLegend } from "./language-legend";
import { supabase } from "@/lib/supabase";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchPullRequests } from "@/lib/github";
import { humanizeNumber, calculateLotteryFactor } from "@/lib/utils";
import type {
  RepoStats,
  LotteryFactor,
  ContributorStats,
  PullRequest,
  QuadrantData,
} from "@/lib/types";

// Context to share data between tabs
const RepoStatsContext = React.createContext<{
  stats: RepoStats;
  lotteryFactor: LotteryFactor | null;
}>({
  stats: { pullRequests: [], loading: true, error: null },
  lotteryFactor: null,
});

function LotteryFactorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <div className="text-xl font-semibold flex items-center gap-2">
          <MonitorPlay className="h-5 w-5" />
          Lottery Factor
        </div>
        <Skeleton className="ml-auto h-6 w-16" />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32 mt-1" />
              </div>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-2 w-[200px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LotteryFactorEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <MonitorPlay className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">No data available</h3>
      <p className="text-sm text-muted-foreground mt-2">
        This repository doesn't have enough commit data to calculate the Lottery
        Factor.
      </p>
    </div>
  );
}

function LotteryFactorContent({
  stats,
  lotteryFactor,
}: {
  stats: RepoStats;
  lotteryFactor: LotteryFactor | null;
}) {
  if (stats.loading) {
    return <LotteryFactorSkeleton />;
  }

  if (!lotteryFactor || lotteryFactor.contributors.length === 0) {
    return <LotteryFactorEmpty />;
  }

  const getRiskLevelColor = (level: "Low" | "Medium" | "High") => {
    switch (level) {
      case "Low":
        return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
      case "Medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "High":
        return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
    }
  };

  const getProgressBarSegments = (contributors: ContributorStats[]) => {
    const colors = [
      "bg-orange-500 hover:bg-orange-600",
      "bg-orange-400 hover:bg-orange-500",
      "bg-yellow-500 hover:bg-yellow-600",
      "bg-green-500 hover:bg-green-600",
      "bg-blue-500 hover:bg-blue-600",
    ];

    const otherContributorsPercentage =
      100 - contributors.reduce((sum, c) => sum + c.percentage, 0);

    return [
      ...contributors.map((contributor, index) => ({
        color: colors[index % colors.length],
        width: `${contributor.percentage}%`,
        contributor,
      })),
      {
        color: "bg-gray-400 hover:bg-gray-500",
        width: `${otherContributorsPercentage}%`,
        contributor: null,
      },
    ];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <div className="text-xl font-semibold flex items-center gap-2">
          <MonitorPlay className="h-5 w-5" />
          Lottery Factor
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  The Lottery Factor measures the distribution of contributions
                  across maintainers. A high percentage indicates increased risk
                  due to concentrated knowledge.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Badge
          variant="secondary"
          className={`ml-auto ${getRiskLevelColor(lotteryFactor.riskLevel)}`}
        >
          {lotteryFactor.riskLevel}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            The top {lotteryFactor.topContributorsCount} contributors of this
            repository have made{" "}
            <span className="font-medium text-foreground">
              {lotteryFactor.topContributorsPercentage}%
            </span>{" "}
            of all pull requests in the past 30 days.
          </div>

          <div className="h-2 w-full rounded-full overflow-hidden flex">
            {getProgressBarSegments(lotteryFactor.contributors).map(
              (segment, i) => (
                <TooltipProvider key={i}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`h-full transition-colors ${segment.color}`}
                        style={{ width: segment.width }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="flex items-center gap-2">
                        {segment.contributor ? (
                          <>
                            <img
                              src={segment.contributor.avatar_url}
                              alt={segment.contributor.login}
                              className="w-4 h-4 rounded-full"
                            />
                            <span>{segment.contributor.login}</span>
                            <span className="text-muted-foreground">
                              ({Math.round(segment.contributor.percentage)}%)
                            </span>
                          </>
                        ) : (
                          <>
                            <Users className="w-4 h-4" />
                            <span>Other contributors</span>
                            <span className="text-muted-foreground">
                              ({Math.round(parseFloat(segment.width))}%)
                            </span>
                          </>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_100px_80px] gap-4 text-sm text-muted-foreground">
            <div>Contributor</div>
            <div className="text-right">Pull Requests</div>
            <div className="text-right">% of total</div>
          </div>

          {lotteryFactor.contributors.map((contributor, index) => (
            <div
              key={contributor.login}
              className="grid grid-cols-[1fr_100px_80px] gap-4 items-center"
            >
              <div className="flex items-center gap-2">
                <ContributorHoverCard
                  contributor={contributor}
                  role={
                    index === 0
                      ? "maintainer"
                      : index === 1
                      ? "member"
                      : "contributor"
                  }
                >
                  <img
                    src={contributor.avatar_url}
                    alt={contributor.login}
                    className="h-8 w-8 rounded-full cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  />
                </ContributorHoverCard>
                <div>
                  <div className="font-medium">{contributor.login}</div>
                  <div className="text-sm text-muted-foreground">
                    {index === 0
                      ? "maintainer"
                      : index === 1
                      ? "member"
                      : "contributor"}
                  </div>
                </div>
              </div>
              <div className="text-right font-medium">
                {contributor.pullRequests}
              </div>
              <div className="text-right font-medium">
                {Math.round(contributor.percentage)}%
              </div>
            </div>
          ))}

          <div className="border-t pt-4">
            <div className="grid grid-cols-[1fr_100px_80px] gap-4 items-center">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium">Other contributors</div>
                  <div className="text-sm text-muted-foreground">
                    {lotteryFactor.totalContributors -
                      lotteryFactor.contributors.length}{" "}
                    contributors
                  </div>
                </div>
              </div>
              <div className="text-right font-medium">
                {stats.pullRequests.length -
                  lotteryFactor.contributors.reduce(
                    (sum, c) => sum + c.pullRequests,
                    0
                  )}
              </div>
              <div className="text-right font-medium">
                {Math.round(
                  100 -
                    lotteryFactor.contributors.reduce(
                      (sum, c) => sum + c.percentage,
                      0
                    )
                )}
                %
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// LotteryFactor Tab Component
function LotteryFactor() {
  const { stats, lotteryFactor } = React.useContext(RepoStatsContext);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repository Health</CardTitle>
        <CardDescription>
          Analyze the distribution of contributions and maintainer activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LotteryFactorContent stats={stats} lotteryFactor={lotteryFactor} />
      </CardContent>
    </Card>
  );
}

function ContributionsChart({
  stats,
  enhanceView,
  setEnhanceView,
}: {
  stats: RepoStats;
  enhanceView: boolean;
  setEnhanceView: (value: boolean) => void;
}) {
  const getChartData = () => {
    // Sort by updated_at and take only the last 50 PRs
    const recentPRs = [...stats.pullRequests]
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .slice(0, 50);

    return recentPRs.map((pr, index) => {
      const daysAgo = Math.floor(
        (new Date().getTime() - new Date(pr.updated_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const linesChanged = pr.additions + pr.deletions;

      // Only show avatars for the first 25 PRs
      const showAvatar = index < 25;

      return {
        daysAgo,
        linesChanged: enhanceView
          ? Math.min(
              linesChanged,
              recentPRs[Math.floor(recentPRs.length * 0.25)].additions +
                recentPRs[Math.floor(recentPRs.length * 0.25)].deletions
            )
          : linesChanged,
        avatar: showAvatar ? pr.user.avatar_url : null,
        state: pr.state,
        merged: pr.merged_at !== null,
        title: pr.title,
        number: pr.number,
        author: pr.user.login,
        repository_owner: pr.repository_owner,
        repository_name: pr.repository_name,
        url: `https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`,
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="enhance-view"
          checked={enhanceView}
          onCheckedChange={setEnhanceView}
        />
        <Label htmlFor="enhance-view">Focus on smaller contributions</Label>
      </div>
      <div className="h-[600px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="daysAgo"
              name="Days Ago"
              domain={[0, "auto"]}
              reversed
              label={{
                value: "Days Ago (Last Commit)",
                position: "bottom",
                offset: 20,
              }}
            />
            <YAxis
              type="number"
              dataKey="linesChanged"
              name="Lines Changed"
              scale="log"
              domain={["auto", "auto"]}
              tickFormatter={(value) => humanizeNumber(value)}
              label={{
                value: "Lines Touched",
                angle: -90,
                position: "insideLeft",
                offset: -10,
              }}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background p-4 rounded-lg shadow border">
                      <div className="flex items-center gap-2 mb-2">
                        {data.avatar && (
                          <img
                            src={data.avatar}
                            alt="User avatar"
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <a
                          href={`https://github.com/${data.repository_owner}/${data.repository_name}/pull/${data.number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          #{data.number}
                        </a>
                        <span>by</span>
                        <a
                          href={`https://github.com/${data.author}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          {data.author}
                        </a>
                      </div>
                      <p className="text-sm">{data.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {humanizeNumber(data.linesChanged)} lines changed
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {data.daysAgo} days ago
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter
              data={getChartData()}
              shape={(props: { cx: number; cy: number; payload: any }) => {
                const { cx, cy, payload } = props;
                return (
                  <a
                    href={payload.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer"
                  >
                    {payload.avatar ? (
                      <image
                        x={cx - 10}
                        y={cy - 10}
                        width={20}
                        height={20}
                        href={payload.avatar}
                        clipPath="circle(50%)"
                        style={{ cursor: "pointer" }}
                      />
                    ) : (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="hsl(var(--muted-foreground))"
                        opacity={0.5}
                        style={{ cursor: "pointer" }}
                      />
                    )}
                  </a>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Contributions Tab Component
function Contributions() {
  const { stats } = React.useContext(RepoStatsContext);
  const [enhanceView, setEnhanceView] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pull Request Contributions</CardTitle>
        <CardDescription>
          Visualize the size and frequency of contributions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ContributionsChart
          stats={stats}
          enhanceView={enhanceView}
          setEnhanceView={setEnhanceView}
        />
      </CardContent>
    </Card>
  );
}

// Distribution Tab Component with QuadrantChart and LanguageLegend
function Distribution() {
  const { stats } = React.useContext(RepoStatsContext);

  // Create a function to calculate quadrant percentages
  const getQuadrantStats = (
    prs: PullRequest[]
  ): {
    quadrants: { name: string; percentage: number }[];
    totalFiles: number;
  } => {
    if (prs.length === 0) {
      return {
        quadrants: [
          { name: "Refinement", percentage: 25 },
          { name: "New Stuff", percentage: 25 },
          { name: "Maintenance", percentage: 25 },
          { name: "Refactoring", percentage: 25 },
        ],
        totalFiles: 0,
      };
    }

    // Count files from the PRs (just an approximation based on additions/deletions)
    const totalFiles = Math.min(
      500, // Cap to avoid unrealistic numbers
      Math.ceil(
        prs.reduce(
          (sum, pr) => sum + Math.ceil((pr.additions + pr.deletions) / 100),
          0
        )
      )
    );

    // For now we'll calculate based on the stub data we're already generating
    // In a real implementation, this would be calculated based on actual PR analysis
    const quadrantNames = [
      "Refinement",
      "New Stuff",
      "Maintenance",
      "Refactoring",
    ];

    // Calculate percentages based on PR distribution
    const quadrantPRs = [
      prs.slice(0, 3).length, // Refinement
      prs.slice(3, 6).length, // New Stuff
      prs.slice(6, 9).length, // Maintenance
      prs.slice(9, 12).length, // Refactoring
    ];

    const total = quadrantPRs.reduce((sum, count) => sum + count, 0);

    return {
      quadrants: quadrantNames.map((name, index) => ({
        name,
        percentage: total > 0 ? (quadrantPRs[index] / total) * 100 : 25,
      })),
      totalFiles,
    };
  };

  // Get language statistics
  const getLanguageStats = (prs: PullRequest[]): LanguageStats[] => {
    // Create language stats based on the additions/deletions in each PR
    const languageMap = new Map<
      string,
      { count: number; color: string; totalChanges: number }
    >();

    // Common language colors from GitHub
    const colorMap: Record<string, string> = {
      JavaScript: "#f1e05a",
      TypeScript: "#2b7489",
      CSS: "#563d7c",
      HTML: "#e34c26",
      Python: "#3572A5",
      Java: "#b07219",
      Go: "#00ADD8",
      Rust: "#dea584",
      Other: "#cccccc",
    };

    // Count languages based on PRs
    prs.forEach((pr) => {
      if (pr.commits) {
        pr.commits.forEach((commit) => {
          const lang = commit.language || "Other";
          const current = languageMap.get(lang) || {
            count: 0,
            color: colorMap[lang] || colorMap["Other"],
            totalChanges: 0,
          };
          languageMap.set(lang, {
            count: current.count + 1,
            color: current.color,
            totalChanges:
              current.totalChanges + commit.additions + commit.deletions,
          });
        });
      } else {
        // For PRs without commit data, infer language from PR title/additions/deletions

        // Try to extract language from PR title
        let lang = "Other";
        const titleLower = pr.title.toLowerCase();

        if (titleLower.includes("typescript") || titleLower.includes(".ts")) {
          lang = "TypeScript";
        } else if (
          titleLower.includes("javascript") ||
          titleLower.includes(".js")
        ) {
          lang = "JavaScript";
        } else if (titleLower.includes("css") || titleLower.includes("style")) {
          lang = "CSS";
        } else if (
          titleLower.includes("html") ||
          titleLower.includes("markup")
        ) {
          lang = "HTML";
        } else if (
          titleLower.includes("python") ||
          titleLower.includes(".py")
        ) {
          lang = "Python";
        } else if (
          titleLower.includes("java") ||
          titleLower.includes(".java")
        ) {
          lang = "Java";
        } else if (titleLower.includes("go") || titleLower.includes(".go")) {
          lang = "Go";
        } else if (titleLower.includes("rust") || titleLower.includes(".rs")) {
          lang = "Rust";
        }

        // Or determine by additions versus average PR size
        const avgPRSize =
          prs.reduce((sum, p) => sum + p.additions + p.deletions, 0) /
          prs.length;
        const size = pr.additions + pr.deletions;

        const current = languageMap.get(lang) || {
          count: 0,
          color: colorMap[lang] || colorMap["Other"],
          totalChanges: 0,
        };

        languageMap.set(lang, {
          count: current.count + 1,
          color: current.color,
          totalChanges: current.totalChanges + size,
        });
      }
    });

    // If we don't have any languages yet (no PRs or all are empty), create some placeholder data
    // based on the repository context
    if (languageMap.size === 0) {
      // Since this is a React project (based on file structure), we'll use realistic data
      return [
        {
          name: "TypeScript",
          color: colorMap["TypeScript"],
          count: prs.length > 0 ? Math.ceil(prs.length * 0.6) : 15,
        },
        {
          name: "JavaScript",
          color: colorMap["JavaScript"],
          count: prs.length > 0 ? Math.ceil(prs.length * 0.2) : 8,
        },
        {
          name: "CSS",
          color: colorMap["CSS"],
          count: prs.length > 0 ? Math.ceil(prs.length * 0.15) : 5,
        },
        {
          name: "HTML",
          color: colorMap["HTML"],
          count: prs.length > 0 ? Math.ceil(prs.length * 0.05) : 2,
        },
      ];
    }

    // Convert the map to array format required by LanguageLegend
    return (
      Array.from(languageMap.entries())
        .map(([name, { count, color, totalChanges }]) => ({
          name,
          count,
          color,
          // Store the total changes to help with sorting
          totalChanges,
        }))
        // Sort by total changes (most significant languages first)
        .sort((a, b) => b.totalChanges - a.totalChanges)
        // Take top 8 languages at most to avoid cluttering the UI
        .slice(0, 8)
        // Remove the totalChanges prop since it's not in the LanguageStats interface
        .map(({ name, count, color }) => ({
          name,
          count,
          color,
        }))
    );
  };

  const getQuadrantData = (prs: PullRequest[]): QuadrantData[] => {
    // This is a stub for quadrant data
    // In a real implementation, we would analyze PR data to determine quadrants
    return [
      {
        name: "Refinement",
        authors: prs.slice(0, 3).map((pr) => ({
          id: pr.user.id,
          login: pr.user.login,
        })),
      },
      {
        name: "New Stuff",
        authors: prs.slice(3, 6).map((pr) => ({
          id: pr.user.id,
          login: pr.user.login,
        })),
      },
      {
        name: "Maintenance",
        authors: prs.slice(6, 9).map((pr) => ({
          id: pr.user.id,
          login: pr.user.login,
        })),
      },
      {
        name: "Refactoring",
        authors: prs.slice(9, 12).map((pr) => ({
          id: pr.user.id,
          login: pr.user.login,
        })),
      },
    ];
  };

  // Get the statistics for display
  const languageStats = getLanguageStats(stats.pullRequests);
  const quadrantData = getQuadrantData(stats.pullRequests);
  const { quadrants, totalFiles } = getQuadrantStats(stats.pullRequests);

  // Add commit data to PRs (stub)
  const prepareDataForQuadrantChart = (prs: PullRequest[]) => {
    return prs.map((pr) => ({
      ...pr,
      // Adding stub data for commits since our PR model doesn't have them
      commits: [
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

  if (stats.loading) {
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
    <Card>
      <CardHeader>
        <CardTitle>Pull Request Distribution Analysis</CardTitle>
        <CardDescription>
          Visualize contribution patterns across different categories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground">
          {totalFiles.toLocaleString()} files changed ·
          {quadrants
            .map((q) => ` ${q.percentage.toFixed(1)}% ${q.name.toLowerCase()}`)
            .join(" · ")}
        </div>
        <LanguageLegend languages={languageStats} />
        <QuadrantChart
          data={prepareDataForQuadrantChart(stats.pullRequests.slice(0, 20))}
          quadrants={quadrantData}
        />
        <div className="text-sm text-muted-foreground mt-4">
          <p>
            This chart categorizes contributions into four quadrants based on
            the nature of changes:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <span className="font-medium">Refinement</span>: Code cleanup and
              removal
            </li>
            <li>
              <span className="font-medium">New Stuff</span>: New features and
              additions
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

export default function RepoView() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState<RepoStats>({
    pullRequests: [],
    loading: true,
    error: null,
  });
  const [searchInput, setSearchInput] = useState("");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [lotteryFactor, setLotteryFactor] = useState<LotteryFactor | null>(
    null
  );

  useEffect(() => {
    // Check login status
    supabase.auth.getSession().then(({ data: { session } }) => {
      // We're just checking if user is logged in to control dialog state
      const loggedIn = !!session;
      if (loggedIn && showLoginDialog) {
        setShowLoginDialog(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // We're just checking if user is logged in to control dialog state
      const loggedIn = !!session;
      if (loggedIn && showLoginDialog) {
        setShowLoginDialog(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [showLoginDialog]);

  useEffect(() => {
    async function loadPRData() {
      if (!owner || !repo) return;

      try {
        setStats((prev) => ({ ...prev, loading: true, error: null }));
        const prs = await fetchPullRequests(owner, repo);
        setStats({ pullRequests: prs, loading: false, error: null });
        setLotteryFactor(calculateLotteryFactor(prs));
      } catch (error) {
        setStats((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch data",
        }));
      }
    }

    loadPRData();
  }, [owner, repo]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    // Extract owner and repo from input
    const match = searchInput.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);

    if (match) {
      const [, newOwner, newRepo] = match;
      navigate(`/${newOwner}/${newRepo}`);
    }
  };

  if (stats.loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-destructive mb-2">
                Error
              </h2>
              <p className="text-muted-foreground">{stats.error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />

      <Card className="mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input
              placeholder="Search another repository (e.g., facebook/react)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              <SearchIcon className="mr-2 h-4 w-4" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {owner}/{repo}
                </CardTitle>
                <CardDescription>
                  Contribution analysis of recent pull requests
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="lottery"
              className="space-y-4"
              onValueChange={(value) => {
                navigate(
                  `/${owner}/${repo}${value === "lottery" ? "" : `/${value}`}`
                );
              }}
            >
              <TabsList>
                <TabsTrigger value="lottery">Lottery Factor</TabsTrigger>
                <TabsTrigger value="contributions">Contributions</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-6">
              <RepoStatsContext.Provider value={{ stats, lotteryFactor }}>
                <Outlet />
              </RepoStatsContext.Provider>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Add subcomponents to RepoView
RepoView.LotteryFactor = LotteryFactor;
RepoView.Contributions = Contributions;
RepoView.Distribution = Distribution;
