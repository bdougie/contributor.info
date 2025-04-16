import { useContext } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, MonitorPlay, Users } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContributorHoverCard } from "./contributor-hover-card";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import type {
  RepoStats,
  LotteryFactor as LotteryFactorType,
  ContributorStats,
} from "@/lib/types";

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

export function LotteryFactorContent({
  stats,
  lotteryFactor,
}: {
  stats?: RepoStats;
  lotteryFactor?: LotteryFactorType | null;
}) {
  const safeStats = stats || { pullRequests: [], loading: false, error: null };
  const safeLotteryFactor = lotteryFactor || null;

  if (safeStats.loading) {
    return <LotteryFactorSkeleton />;
  }

  if (!safeLotteryFactor || safeLotteryFactor.contributors.length === 0) {
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
          className={`ml-auto ${getRiskLevelColor(
            safeLotteryFactor.riskLevel
          )}`}
        >
          {safeLotteryFactor.riskLevel}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            The top {safeLotteryFactor.topContributorsCount} contributors of
            this repository have made{" "}
            <span className="font-medium text-foreground">
              {safeLotteryFactor.topContributorsPercentage}%
            </span>{" "}
            of all pull requests in the past 30 days.
          </div>

          <div className="h-2 w-full rounded-full overflow-hidden flex">
            {getProgressBarSegments(safeLotteryFactor.contributors).map(
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

          {safeLotteryFactor.contributors.map((contributor, index) => (
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
                    {safeLotteryFactor.totalContributors -
                      safeLotteryFactor.contributors.length}{" "}
                    contributors
                  </div>
                </div>
              </div>
              <div className="text-right font-medium">
                {safeStats.pullRequests.length -
                  safeLotteryFactor.contributors.reduce(
                    (sum, c) => sum + c.pullRequests,
                    0
                  )}
              </div>
              <div className="text-right font-medium">
                {Math.round(
                  100 -
                    safeLotteryFactor.contributors.reduce(
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

// LotteryFactor Tab Component that uses Context
export default function LotteryFactor() {
  const { stats, lotteryFactor } = useContext(RepoStatsContext);

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
