import { useContext, useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, Users, Bot, ArrowLeft, ArrowRight, GitPullRequest, Percent } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { ContributorHoverCard } from "../contributor";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import { YoloIcon } from "@/components/icons/YoloIcon";
import { LotteryIcon } from "@/components/icons/LotteryIcon";
import { ShareableCard } from "@/components/features/sharing/shareable-card";
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
          <LotteryIcon className="h-5 w-5" />
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
      <LotteryIcon className="h-5 w-5" />
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
  includeBots = true,
}: {
  stats?: RepoStats;
  lotteryFactor?: LotteryFactorType | null;
  showYoloButton?: boolean;
  includeBots?: boolean;
}) {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { timeRange } = useTimeRange();
  const timeRangeNumber = parseInt(timeRange, 10); // Parse the string to a number
  const rawStats = stats || { pullRequests: [], loading: false, error: null };
  const rawLotteryFactor = lotteryFactor || null;
  const repositoryName = owner && repo ? `${owner}/${repo}` : undefined;
  
  // State for contributor roles from confidence system
  const [contributorRoles, setContributorRoles] = useState<Map<string, string>>(new Map());

  // Apply client-side filtering based on includeBots
  const safeStats = {
    ...rawStats,
    pullRequests: includeBots 
      ? rawStats.pullRequests 
      : rawStats.pullRequests.filter(pr => pr.user.type !== "Bot")
  };

  // Filter lottery factor contributors based on includeBots
  const safeLotteryFactor = rawLotteryFactor && !includeBots
    ? {
        ...rawLotteryFactor,
        contributors: rawLotteryFactor.contributors.filter(contributor => {
          // Find the corresponding PR to check if user is a bot
          const userPRs = rawStats.pullRequests.filter(pr => pr.user.login === contributor.login);
          return userPRs.length === 0 || userPRs[0].user.type !== "Bot";
        })
      }
    : rawLotteryFactor;
  const [showYoloCoders, setShowYoloCoders] = useState(false);
  const { directCommitsData } = useContext(RepoStatsContext);

  // Fetch contributor roles from confidence system
  useEffect(() => {
    async function fetchContributorRoles() {
      if (!owner || !repo) return;
      
      try {
        const { data, error } = await supabase
          .from('contributor_roles')
          .select('user_id, role')
          .eq('repository_owner', owner)
          .eq('repository_name', repo);
        
        if (error) {
          console.warn('Failed to fetch contributor roles:', error);
          return;
        }
        
        const rolesMap = new Map<string, string>();
        data?.forEach(({ user_id, role }) => {
          rolesMap.set(user_id, role);
        });
        setContributorRoles(rolesMap);
      } catch (error) {
        console.warn('Error fetching contributor roles:', error);
      }
    }
    
    fetchContributorRoles();
  }, [owner, repo]);

  // Function to get role for a contributor
  const getContributorRole = (username: string, index: number): string => {
    // First try to get role from confidence system
    const confidenceRole = contributorRoles.get(username);
    if (confidenceRole) {
      return confidenceRole;
    }
    
    // Fallback to old position-based system
    if (index === 0) return "maintainer";
    if (index === 1) return "member";
    return "contributor";
  };

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
        <ShareableCard
          title="YOLO Coders"
          contextInfo={{
            repository: repositoryName,
            metric: "direct commits"
          }}
          chartType="yolo-coders"
        >
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
        </ShareableCard>
      );
    }

    return (
      <ShareableCard
        title="YOLO Coders"
        contextInfo={{
          repository: repositoryName,
          metric: "direct commits"
        }}
        chartType="yolo-coders"
      >
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
                  <OptimizedAvatar
                    src={coder.avatar_url}
                    alt={coder.login}
                    size={32}
                    lazy={false}
                    fallback={coder.login[0]?.toUpperCase() || '?'}
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
      </ShareableCard>
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
    <ShareableCard
      title="Lottery Factor"
      contextInfo={{
        repository: repositoryName,
        metric: "lottery factor"
      }}
      chartType="lottery-factor"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <div className="text-xl font-semibold flex items-center gap-2">
              <LotteryIcon className="h-5 w-5 hidden sm:block" />
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
              className="flex items-center justify-between w-full text-slate-500 shadow-sm !border !border-slate-300 p-2 sm:p-1 gap-2 text-sm rounded-full"
            >
              <div className="flex gap-2 items-center min-w-0 flex-1">
                <div className="flex items-center font-medium gap-1 px-2 py-0.5 rounded-2xl bg-light-red-4 text-light-red-11 flex-shrink-0">
                  <YoloIcon className="h-4 w-4" />
                  <span className="hidden xs:inline">YOLO Coders</span>
                  <span className="xs:hidden">YOLO</span>
                </div>
                <p className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  commits directly on main
                </p>
              </div>

              <div className="flex gap-2 items-center ml-auto mr-1 sm:mr-3 flex-shrink-0">
                <p className="hidden sm:inline-block xl:hidden min-[1650px]:inline-block">
                  See more
                </p>
                <ArrowRight className="h-4 w-4" />
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
                            <OptimizedAvatar
                              src={segment.contributor.avatar_url}
                              alt={segment.contributor.login}
                              size={32}
                              lazy={false}
                              fallback={segment.contributor.login[0]?.toUpperCase() || '?'}
                              className="w-4 h-4"
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
          <div className="hidden sm:grid grid-cols-[1fr_100px_80px] gap-4 text-sm text-muted-foreground">
            <div>Contributor</div>
            <div className="text-right">Pull Requests</div>
            <div className="text-right">% of total</div>
          </div>

          {safeLotteryFactor.contributors.map((contributor, index) => (
            <div
              key={contributor.login}
              className="flex flex-col space-y-2 sm:grid sm:grid-cols-[1fr_100px_80px] sm:gap-4 sm:items-center sm:space-y-0"
            >
              <div className="flex items-center gap-2">
                <ContributorHoverCard
                  contributor={contributor}
                  role={getContributorRole(contributor.login, index)}
                >
                  <OptimizedAvatar
                    src={contributor.avatar_url}
                    alt={contributor.login}
                    size={32}
                    lazy={false}
                    fallback={contributor.login[0]?.toUpperCase() || '?'}
                    className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  />
                </ContributorHoverCard>
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ wordBreak: 'break-word' }}>{contributor.login}</div>
                  <div className="text-sm text-muted-foreground flex items-center justify-between">
                    <span>
                      {getContributorRole(contributor.login, index)}
                    </span>
                    <div className="flex items-center gap-2 sm:hidden">
                      <span className="flex items-center gap-1">
                        <span className="text-xs">{contributor.pullRequests}</span>
                        <GitPullRequest className="h-3 w-3" />
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-xs">{Math.round(contributor.percentage)}</span>
                        <Percent className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex sm:justify-between sm:contents">
                <div className="sm:text-right font-medium flex items-center gap-1 sm:justify-end">
                  <span className="text-base">{contributor.pullRequests}</span>
                </div>
                <div className="sm:text-right font-medium flex items-center gap-1 sm:justify-end">
                  <span className="text-base">{Math.round(contributor.percentage)}%</span>
                </div>
              </div>
            </div>
          ))}

          <div className="border-t pt-4">
            <div className="flex flex-col space-y-2 sm:grid sm:grid-cols-[1fr_100px_80px] sm:gap-4 sm:items-center sm:space-y-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">Other contributors</div>
                  <div className="text-sm text-muted-foreground flex items-center justify-between">
                    <span>
                      {safeLotteryFactor.totalContributors -
                        safeLotteryFactor.contributors.length}{" "}
                      contributors
                    </span>
                    <div className="flex items-center gap-2 sm:hidden">
                      <span className="flex items-center gap-1">
                        <span className="text-xs">
                          {safeStats.pullRequests.length -
                            safeLotteryFactor.contributors.reduce(
                              (sum, c) => sum + c.pullRequests,
                              0
                            )}
                        </span>
                        <GitPullRequest className="h-3 w-3" />
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-xs">
                          {Math.round(
                            100 -
                              safeLotteryFactor.contributors.reduce(
                                (sum, c) => sum + c.percentage,
                                0
                              )
                          )}
                        </span>
                        <Percent className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex sm:justify-between sm:contents">
                <div className="sm:text-right font-medium flex items-center gap-1 sm:justify-end">
                  <span className="text-base">
                    {safeStats.pullRequests.length -
                      safeLotteryFactor.contributors.reduce(
                        (sum, c) => sum + c.pullRequests,
                        0
                      )}
                  </span>
                </div>
                <div className="sm:text-right font-medium flex items-center gap-1 sm:justify-end">
                  <span className="text-base">
                    {Math.round(
                      100 -
                        safeLotteryFactor.contributors.reduce(
                          (sum, c) => sum + c.percentage,
                          0
                        )
                    )}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ShareableCard>
  );
}

// LotteryFactor Tab Component that uses Context
export default function LotteryFactor() {
  const {
    stats,
    lotteryFactor,
    directCommitsData,
    includeBots,
  } = useContext(RepoStatsContext);

  // Local state for bot toggle to avoid page refresh
  const [localIncludeBots, setLocalIncludeBots] = useState(includeBots);
  const functionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sync local state with context when it changes
  useEffect(() => {
    setLocalIncludeBots(includeBots);
  }, [includeBots]);

  const botCount = stats.pullRequests.filter(
    (pr) => pr.user.type === "Bot"
  ).length;
  const hasBots = botCount > 0;
  // YOLO Coders button should only be visible if there are YOLO pushes
  const showYoloButton = directCommitsData?.hasYoloCoders === true;

  const handleToggleIncludeBots = () => {
    if (functionTimeout.current) {
      clearTimeout(functionTimeout.current);
    }
    functionTimeout.current = setTimeout(() => {
      setLocalIncludeBots(!localIncludeBots);
      // We're not calling setIncludeBots anymore to avoid triggering a global state update
    }, 50);
  };

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
          includeBots={localIncludeBots}
        />

        {hasBots && (
          <div className="flex items-center space-x-2 mt-6 pt-4 border-t">
            <Switch
              id="show-bots"
              checked={localIncludeBots}
              onCheckedChange={handleToggleIncludeBots}
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
