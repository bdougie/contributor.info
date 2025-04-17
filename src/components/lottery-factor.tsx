import { useContext, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, Users, Bot, ArrowLeft, ArrowRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ContributorHoverCard } from "./contributor-hover-card";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import { YoloIcon } from "./icons/YoloIcon";
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
          <span>🎟️</span>
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
      <span>🎟️</span>
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
  showYoloButton,
}: {
  stats?: RepoStats;
  lotteryFactor?: LotteryFactorType | null;
  showYoloButton?: boolean;
}) {
  const { timeRange } = useTimeRange();
  const timeRangeNumber = parseInt(timeRange, 10); // Parse the string to a number
  const safeStats = stats || { pullRequests: [], loading: false, error: null };
  const safeLotteryFactor = lotteryFactor || null;
  const [showYoloCoders, setShowYoloCoders] = useState(false);
  const { directCommitsData } = useContext(RepoStatsContext);

  if (safeStats.loading) {
    return <LotteryFactorSkeleton />;
  }

  if (!safeLotteryFactor || safeLotteryFactor.contributors.length === 0) {
    return <LotteryFactorEmpty />;
  }

  // YOLO Coders View
  if (showYoloCoders) {
    // Check if we have YOLO coders data
    if (!directCommitsData || directCommitsData.yoloCoderStats.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowYoloCoders(false)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              back
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <YoloIcon className="w-4 h-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">YOLO Coders</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            No direct commits to the main branch detected in the last{" "}
            {timeRangeNumber} days.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowYoloCoders(false)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            back
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <YoloIcon className="w-4 h-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">YOLO Coders</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {directCommitsData.yoloCoderStats.length} contributor
          {directCommitsData.yoloCoderStats.length !== 1 ? "s" : ""} have pushed
          directly to the main branch of this repository in the last{" "}
          {timeRangeNumber} days without pull requests
        </p>
        <div className="space-y-4 mt-2">
          {directCommitsData.yoloCoderStats.map((coder) => (
            <div
              key={coder.login}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <img
                  src={coder.avatar_url}
                  alt={coder.login}
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <p className="font-medium">{coder.login}</p>
                  <p className="text-sm text-muted-foreground">
                    {coder.type === "Bot" ? "bot" : "contributor"}
                  </p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{coder.directCommits}</span> push
                {coder.directCommits !== 1 ? "es" : ""} with{" "}
                <span className="font-medium">{coder.totalPushedCommits}</span>{" "}
                commit{coder.totalPushedCommits !== 1 ? "s" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="text-xl font-semibold flex items-center gap-2">
            <span>🎟️</span>
            Lottery Factor
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    The Lottery Factor measures the distribution of
                    contributions across maintainers. A high percentage
                    indicates increased risk due to concentrated knowledge.
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

        {showYoloButton && (
          <button
            onClick={() => setShowYoloCoders(true)}
            className="flex items-center justify-between w-full text-slate-500 shadow-sm !border !border-slate-300 p-1 gap-2 text-sm rounded-full"
          >
            <div className="flex gap-2 items-center">
              <div className="flex items-center font-medium gap-1 px-2 py-0.5 rounded-2xl bg-light-red-4 text-light-red-11">
                <YoloIcon className="h-4 w-4" />
                YOLO Coders
              </div>
              <p className="block lg:hidden 2xl:block">
                Pushing commits{" "}
                <span className="xs:hidden sm:inline-block">directly</span> to
                main
              </p>
            </div>

            <div className="hidden xs:flex gap-2 items-center ml-auto mr-3">
              <p className="hidden sm:inline-block xl:hidden min-[1650px]:inline-block">
                See more
              </p>
              <ArrowRight className="hidden xs:inline-block h-4 w-4" />
            </div>
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            The top {safeLotteryFactor.topContributorsCount} contributors of
            this repository have made{" "}
            <span className="font-medium text-foreground">
              {safeLotteryFactor.topContributorsPercentage}%
            </span>{" "}
            of all pull requests in the past {timeRangeNumber} days.
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
  const {
    stats,
    lotteryFactor,
    directCommitsData,
    includeBots,
    setIncludeBots,
  } = useContext(RepoStatsContext);

  const botCount = stats.pullRequests.filter(
    (pr) => pr.user.type === "Bot"
  ).length;
  const hasBots = botCount > 0;
  // Only show YOLO coders button if there are direct commits
  const hasYoloCoders = directCommitsData?.hasYoloCoders ?? false;
  // YOLO Coders button should only be visible if there are YOLO pushes
  const showYoloButton = directCommitsData?.hasYoloCoders === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repository Health</CardTitle>
        <CardDescription>
          Analyze the distribution of contributions and maintainer activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LotteryFactorContent
          stats={stats}
          lotteryFactor={lotteryFactor}
          showYoloButton={showYoloButton}
        />

        {hasBots && (
          <div className="flex items-center space-x-2 mt-6 pt-4 border-t">
            <Switch
              id="show-bots"
              checked={includeBots}
              onCheckedChange={setIncludeBots}
            />
            <Label
              htmlFor="show-bots"
              className="flex items-center gap-1 cursor-pointer"
            >
              <Bot className="h-4 w-4" />
              Show bots
              {botCount > 0 && (
                <Badge variant="outline" className="ml-1">
                  {botCount}
                </Badge>
              )}
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
