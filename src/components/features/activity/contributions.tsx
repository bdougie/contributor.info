import { useState, useContext, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ResponsiveScatterPlot, ScatterPlotNodeProps } from "@nivo/scatterplot";
import { animated } from "@react-spring/web";
import { humanizeNumber } from "@/lib/utils";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { PullRequest, ContributorStats } from "@/lib/types";
import { ContributorHoverCard } from "../contributor";
import { useContributorRole } from "@/hooks/useContributorRoles";
import { useParams } from "react-router-dom";

function ContributionsChart() {
  const { stats, includeBots: contextIncludeBots } =
    useContext(RepoStatsContext);
  const { effectiveTimeRange } = useTimeRange();
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [isLogarithmic, setIsLogarithmic] = useState(false);
  const [maxFilesModified, setMaxFilesModified] = useState(10);
  const [localIncludeBots, setLocalIncludeBots] = useState(contextIncludeBots);
  const safeStats = stats || { pullRequests: [], loading: false, error: null };
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );
  const effectiveTimeRangeNumber = parseInt(effectiveTimeRange, 10);
  const mobileMaxDays = 7; // Aggressive filtering for mobile

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
    
    // Get the contributor's role
    const { role } = useContributorRole(owner || '', repo || '', props.node.data.contributor);

    return (
      <animated.foreignObject
        width={isMobile ? 28 : 35}
        height={isMobile ? 28 : 35}
        r={props.style.size.to((size: number) => size / 2) as unknown as number}
        y={
          props.style.y.to(
            (yVal: number) => Math.max(0, yVal - (isMobile ? 28 : 35) / 1)
          ) as unknown as number
        }
        x={
          props.style.x.to(
            (xVal: number) => Math.max((isMobile ? 14 : 17.5), xVal - (isMobile ? 28 : 35) / 2)
          ) as unknown as number
        }
        style={{ pointerEvents: "auto", overflow: "visible" }} // This is crucial for hover to work
      >
        <ContributorHoverCard
          contributor={contributorStats}
          role={role?.role || (props.node.data._pr.user.type === "Bot" ? "Bot" : "Contributor")}
        >
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
        </ContributorHoverCard>
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
    <div className="space-y-4 w-full overflow-hidden">
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
      <div className={`${isMobile ? "h-[280px]" : "h-[400px]"} w-full overflow-hidden relative`}>
        <ResponsiveScatterPlot
          nodeSize={isMobile ? 20 : 35}
          data={data}
          margin={{
            top: 20,
            right: isMobile ? 10 : 60,
            bottom: isMobile ? 45 : 70,
            left: isMobile ? 35 : 90,
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
