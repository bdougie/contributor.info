import { useState, useContext, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ResponsiveScatterPlot, ScatterPlotNodeProps } from "@nivo/scatterplot";
import { animated } from "@react-spring/web";
import { humanizeNumber } from "@/lib/utils";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import type { PullRequest, ContributorStats } from "@/lib/types";

function ContributionsChart() {
  const { stats, includeBots: contextIncludeBots } =
    useContext(RepoStatsContext);
  const { effectiveTimeRange } = useTimeRange();
  const [isLogarithmic, setIsLogarithmic] = useState(false);
  const [maxFilesModified, setMaxFilesModified] = useState(10);
  const [localIncludeBots, setLocalIncludeBots] = useState(contextIncludeBots);
  const safeStats = stats || { pullRequests: [], loading: false, error: null };
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );
  const effectiveTimeRangeNumber = parseInt(effectiveTimeRange, 10);
  const mobileMaxDays = 7;

  const functionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add resize listener to update isMobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    // Calculate max files modified for scale
    if (safeStats.pullRequests && safeStats.pullRequests.length > 0) {
      const maxLines = Math.max(
        ...safeStats.pullRequests.map((pr) => pr.additions + pr.deletions)
      );
      setMaxFilesModified(maxLines);
    }
  }, [safeStats.pullRequests]);

  // Sync local state with context state when context changes
  useEffect(() => {
    setLocalIncludeBots(contextIncludeBots);
  }, [contextIncludeBots]);

  const getScatterData = () => {
    // Sort by created_at and filter based on preferences
    const filteredPRs = [...safeStats.pullRequests]
      .filter((pr) => localIncludeBots || pr.user.type !== "Bot")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    const prData = filteredPRs
      .map((pr) => {
        const daysAgo = Math.floor(
          (new Date().getTime() - new Date(pr.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        // Skip PRs older than our limit
        if (
          (isMobile && daysAgo > mobileMaxDays) ||
          (!isMobile && daysAgo > effectiveTimeRangeNumber)
        ) {
          return null;
        }

        return {
          x: daysAgo,
          y: pr.additions + pr.deletions,
          contributor: pr.user.login,
          image: pr.user.avatar_url,
          _pr: pr, // store full PR for hover card
        };
      })
      .filter(
        (
          item
        ): item is {
          x: number;
          y: number;
          contributor: string;
          image: string;
          _pr: PullRequest;
        } => item !== null
      ); // Remove nulls with type guard

    return [
      {
        id: "pull-requests",
        data: prData,
      },
    ];
  };

  // Create a map of contributors for the hover card
  const getContributorStats = (
    login: string,
    pullRequest: PullRequest
  ): ContributorStats => {
    // Calculate percentage and recentPRs based on current PRs
    const totalPRs = safeStats.pullRequests.length;
    const contributorPRs = safeStats.pullRequests.filter(
      (pr) => pr.user.login === login
    );
    const percentage = (contributorPRs.length / totalPRs) * 100;

    return {
      login,
      avatar_url: pullRequest.user.avatar_url,
      pullRequests: contributorPRs.length,
      percentage,
      recentPRs: [
        pullRequest,
        ...contributorPRs.filter((pr) => pr.id !== pullRequest.id),
      ].slice(0, 5),
      // Include organizations if available in PR data
      organizations: pullRequest.organizations || [],
    };
  };

  // Custom Node for scatter plot points
  const CustomNode = (
    props: ScatterPlotNodeProps<{
      x: number;
      y: number;
      contributor: string;
      image: string;
      _pr: PullRequest;
    }>
  ) => {
    const contributorStats = getContributorStats(
      props.node.data.contributor,
      props.node.data._pr
    );

    return (
      <animated.foreignObject
        width={isMobile ? 28 : 35}
        height={isMobile ? 28 : 35}
        r={props.style.size.to((size: number) => size / 2) as unknown as number}
        y={
          props.style.y.to(
            (yVal: number) => yVal - (isMobile ? 28 : 35) / 1
          ) as unknown as number
        }
        x={
          props.style.x.to(
            (xVal: number) => xVal - (isMobile ? 28 : 35) / 2
          ) as unknown as number
        }
        style={{ pointerEvents: "auto" }} // This is crucial for hover to work
      >
        <HoverCardPrimitive.Root openDelay={100} closeDelay={200}>
          <HoverCardPrimitive.Trigger asChild>
            <div className="inline-block" style={{ pointerEvents: "auto" }}>
              <Avatar
                className={`${
                  isMobile ? "w-6 h-6" : "w-8 h-8"
                } border-2 border-background cursor-pointer`}
              >
                <AvatarImage
                  src={props.node.data.image}
                  alt={props.node.data.contributor}
                />
                <AvatarFallback>
                  {props.node.data.contributor
                    ? props.node.data.contributor[0].toUpperCase()
                    : "?"}
                </AvatarFallback>
              </Avatar>
            </div>
          </HoverCardPrimitive.Trigger>
          <HoverCardPrimitive.Portal>
            <HoverCardPrimitive.Content
              side="top"
              align="center"
              sideOffset={5}
              className={`z-50 ${
                isMobile ? "w-64" : "w-80"
              } rounded-md border bg-card p-4 text-card-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`}
              avoidCollisions={true}
            >
              <div className="flex justify-between space-x-4">
                <a
                  href={`https://github.com/${contributorStats.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
                    <AvatarImage src={contributorStats.avatar_url} />
                    <AvatarFallback>
                      {contributorStats.login[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </a>
                <div className="space-y-1">
                  <a
                    href={`https://github.com/${contributorStats.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block hover:underline"
                  >
                    <h4 className="text-sm font-semibold">
                      {contributorStats.login}
                    </h4>
                  </a>
                  {props.node.data._pr.user.type === "Bot" && (
                    <p className="text-sm text-muted-foreground">Bot</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <span>{contributorStats.pullRequests} pull requests</span>
                <span className="text-muted-foreground/50">•</span>
                <span>{Math.round(contributorStats.percentage)}% of total</span>
              </div>

              {contributorStats.recentPRs &&
                contributorStats.recentPRs.length > 0 && (
                  <>
                    <div className="border-t my-4" />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        Recent Pull Requests
                      </div>
                      <div className="space-y-2">
                        {contributorStats.recentPRs.map((pr) => (
                          <a
                            key={pr.id}
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm hover:bg-muted/50 rounded p-1 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-block px-2 py-0.5 text-xs bg-secondary text-secondary-foreground rounded-full">
                                #{pr.number}
                              </span>
                              <span className="truncate">{pr.title}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                )}
            </HoverCardPrimitive.Content>
          </HoverCardPrimitive.Portal>
        </HoverCardPrimitive.Root>
      </animated.foreignObject>
    );
  };

  const handleSetLogarithmic = () => {
    if (functionTimeout.current) {
      clearTimeout(functionTimeout.current);
    }
    functionTimeout.current = setTimeout(() => {
      setIsLogarithmic(!isLogarithmic);
    }, 50);
  };

  const handleToggleIncludeBots = () => {
    if (functionTimeout.current) {
      clearTimeout(functionTimeout.current);
    }
    functionTimeout.current = setTimeout(() => {
      setLocalIncludeBots(!localIncludeBots);
      // We're not calling setIncludeBots anymore to avoid triggering a global state update
    }, 50);
  };

  const data = getScatterData();
  const botCount = safeStats.pullRequests.filter(
    (pr) => pr.user.type === "Bot"
  ).length;
  const hasBots = botCount > 0;

  return (
    <div className="space-y-4 w-full">
      <div
        className={`flex flex-col items-start justify-between pt-3 ${
          isMobile ? "px-2" : "md:flex-row md:px-7"
        }`}
      >
        <div className="text-sm text-muted-foreground">
          {data[0].data.length} pull requests shown
        </div>
        <div className={`flex flex-wrap gap-2 mt-3 md:mt-0 ${isMobile ? "w-full" : ""}`}>
          {hasBots && (
            <div className="flex items-center space-x-2">
              <Switch
                id="include-bots"
                checked={localIncludeBots}
                onCheckedChange={handleToggleIncludeBots}
              />
              <Label htmlFor="include-bots" className="text-sm">
                Show Bots
              </Label>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Switch
              id="logarithmic-scale"
              checked={isLogarithmic}
              onCheckedChange={handleSetLogarithmic}
            />
            <Label htmlFor="logarithmic-scale" className="text-sm">
              Enhance
            </Label>
          </div>
        </div>
      </div>
      <div className={`${isMobile ? "h-[280px]" : "h-[400px]"} w-full`}>
        <ResponsiveScatterPlot
          nodeSize={isMobile ? 20 : 35}
          data={data}
          margin={{
            top: 20,
            right: isMobile ? 5 : 60,
            bottom: isMobile ? 50 : 70,
            left: isMobile ? 30 : 90,
          }}
          xScale={{
            type: "linear",
            min: 0,
            max: isMobile ? mobileMaxDays : effectiveTimeRangeNumber,
            reverse: true,
          }}
          yScale={{
            type: isLogarithmic ? "symlog" : "linear",
            min: 0,
            max: Math.max(Math.round(maxFilesModified * 1.5), 10),
          }}
          blendMode="normal"
          useMesh={false}
          annotations={[]}
          nodeComponent={CustomNode}
          axisBottom={{
            tickSize: 6,
            tickPadding: 4,
            tickRotation: 0,
            tickValues: isMobile ? 3 : 7,
            legend: isMobile ? "Days Ago" : "Date Created",
            legendPosition: "middle",
            legendOffset: isMobile ? 35 : 50,
            format: (value) =>
              value === 0
                ? "Today"
                : value > effectiveTimeRangeNumber
                ? `${effectiveTimeRangeNumber}+`
                : `${value}${isMobile ? "" : " days ago"}`,
          }}
          theme={{
            axis: {},
            grid: {
              line: {
                strokeDasharray: "4 4",
                strokeWidth: 1,
                strokeOpacity: 0.7,
              },
            },
          }}
          isInteractive={true}
          axisLeft={{
            tickSize: 2,
            tickPadding: 3,
            tickRotation: 0,
            tickValues: isMobile ? 3 : 5,
            legend: isMobile ? "Lines" : "Lines Changed",
            legendPosition: "middle",
            legendOffset: isMobile ? -20 : -60,
            format: (value: number) => {
              if (isMobile) {
                return parseInt(`${value}`) >= 1000
                  ? humanizeNumber(value)
                  : `${value}`;
              }
              return parseInt(`${value}`) >= 1000
                ? humanizeNumber(value)
                : `${value}`;
            },
          }}
        />
      </div>
    </div>
  );
}

// Export ContributionsChart as default
export default ContributionsChart;
