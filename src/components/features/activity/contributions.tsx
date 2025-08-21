import { useState, useContext, useEffect, useRef, lazy } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { animated } from "@react-spring/web";
import { supabaseAvatarCache } from "@/lib/supabase-avatar-cache";
import { ProgressiveChart } from "@/components/ui/charts/ProgressiveChart";
import { SkeletonChart } from "@/components/skeletons/base/skeleton-chart";

// Lazy load the heavy visualization component
const ResponsiveScatterPlot = lazy(() => 
  import("@nivo/scatterplot").then(module => ({ 
    default: module.ResponsiveScatterPlot 
  }))
);

// Import types separately since they don't affect bundle size
// import type { ScatterPlotNodeProps } from "@nivo/scatterplot";
import { humanizeNumber } from "@/lib/utils";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { PullRequest } from "@/lib/types";
import { PrHoverCard } from "../contributor/pr-hover-card";
import { useContributorRole } from "@/hooks/useContributorRoles";
import { useParams } from "react-router-dom";
import { useTheme } from "@/components/common/theming/theme-provider";

interface ContributionsChartProps {
  isRepositoryTracked?: boolean;
}

function ContributionsChart({ isRepositoryTracked = true }: ContributionsChartProps) {
  const { stats, includeBots: contextIncludeBots } =
    useContext(RepoStatsContext);
  const { effectiveTimeRange } = useTimeRange();
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { theme } = useTheme();
  const [isLogarithmic, setIsLogarithmic] = useState(false);
  const [maxFilesModified, setMaxFilesModified] = useState(10);
  const [localIncludeBots, setLocalIncludeBots] = useState(contextIncludeBots);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "merged" | "closed">("all");
  const safeStats = stats || { pullRequests: [], loading: false, error: null };
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );
  const [cachedAvatars, setCachedAvatars] = useState<Map<number, string>>(new Map());
  const effectiveTimeRangeNumber = parseInt(effectiveTimeRange, 10);
  const mobileMaxDays = 7; // Aggressive filtering for mobile

  const functionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get the actual theme (resolves 'system' to 'light' or 'dark')
  const getActualTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  // Create Nivo theme object based on current theme
  const getNivoTheme = () => {
    const actualTheme = getActualTheme();
    const isDark = actualTheme === 'dark';
    
    return {
      background: 'transparent',
      text: {
        fontSize: 12,
        fill: isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 3.9%)', // foreground colors
        outlineWidth: 0,
        outlineColor: 'transparent',
      },
      axis: {
        domain: {
          line: {
            stroke: isDark ? 'hsl(0 0% 14.9%)' : 'hsl(0 0% 87%)', // border colors
            strokeWidth: 1,
          },
        },
        legend: {
          text: {
            fontSize: 13,
            fill: isDark ? 'hsl(0 0% 64.9%)' : 'hsl(0 0% 45.1%)', // muted foreground
            outlineWidth: 0,
            outlineColor: 'transparent',
          },
        },
        ticks: {
          line: {
            stroke: isDark ? 'hsl(0 0% 14.9%)' : 'hsl(0 0% 87%)', // border colors
            strokeWidth: 1,
          },
          text: {
            fontSize: 11,
            fill: isDark ? 'hsl(0 0% 64.9%)' : 'hsl(0 0% 45.1%)', // muted foreground
            outlineWidth: 0,
            outlineColor: 'transparent',
          },
        },
      },
      grid: {
        line: {
          stroke: isDark ? 'hsl(0 0% 14.9%)' : 'hsl(0 0% 87%)', // border colors
          strokeWidth: 1,
          strokeOpacity: 0.7,
          strokeDasharray: '4 4',
        },
      },
      crosshair: {
        line: {
          stroke: isDark ? 'hsl(0 0% 98%)' : 'hsl(0 0% 3.9%)', // foreground colors
          strokeWidth: 1,
          strokeOpacity: 0.75,
        },
      },
    };
  };

  // Add resize listener to update isMobile state with throttling
  useEffect(() => {
    const handleResize = () => {
      if (functionTimeout.current) {
        clearTimeout(functionTimeout.current);
      }
      functionTimeout.current = setTimeout(() => {
        setIsMobile(window.innerWidth < 768);
      }, 150); // Throttle resize events
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      if (functionTimeout.current) {
        clearTimeout(functionTimeout.current);
      }
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

  // Load cached avatars when PR data changes
  useEffect(() => {
    const loadCachedAvatars = async () => {
      if (!safeStats.pullRequests?.length) return;

      // Extract unique contributors
      const contributors = Array.from(
        new Map(
          safeStats.pullRequests.map(pr => [
            pr.user.id,
            {
              githubId: pr.user.id,
              username: pr.user.login,
              fallbackUrl: pr.user.avatar_url
            }
          ])
        ).values()
      );

      try {
        // Batch load cached avatars
        const avatarResults = await supabaseAvatarCache.getAvatarUrls(contributors);
        
        // Convert to Map for component state
        const avatarMap = new Map<number, string>();
        avatarResults.forEach((result, githubId) => {
          avatarMap.set(githubId, result.url);
        });
        
        setCachedAvatars(avatarMap);
      } catch (error) {
        // Fallback to original URLs on error
        const fallbackMap = new Map<number, string>();
        contributors.forEach(c => {
          if (c.fallbackUrl) {
            fallbackMap.set(c.githubId, c.fallbackUrl);
          }
        });
        setCachedAvatars(fallbackMap);
      }
    };

    loadCachedAvatars();
  }, [safeStats.pullRequests]);

  // Force re-render when theme changes to update Nivo theme
  const nivoTheme = getNivoTheme();

  const getScatterData = () => {
    // Sort by created_at and filter based on preferences
    const filteredPRs = [...safeStats.pullRequests]
      .filter((pr) => localIncludeBots || pr.user.type !== "Bot")
      .filter((pr) => {
        if (statusFilter === "all") return pr.state === "open" || pr.merged_at !== null;
        if (statusFilter === "open") return pr.state === "open";
        if (statusFilter === "closed") return pr.state === "closed" && !pr.merged_at;
        if (statusFilter === "merged") return pr.merged_at !== null;
        return true;
      })
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

        const linesTouched = pr.additions + pr.deletions;
        // Use cached avatar URL with fallback to original
        const avatarUrl = cachedAvatars.get(pr.user.id) || pr.user.avatar_url;
        return {
          x: daysAgo,
          y: Math.max(linesTouched, 1), // Ensure minimum visibility of 1 line
          contributor: pr.user.login,
          image: avatarUrl,
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


  // Custom Node for scatter plot points
  const CustomNode = (props: any) => {
    // Get the contributor's role
    const { role } = useContributorRole(owner || '', repo || '', props.node.data.contributor);
    
    const size = isMobile ? 28 : 35;
    
    return (
      <animated.foreignObject
        width={size}
        height={size}
        r={props.style.size.to((size: number) => size / 2) as unknown as number}
        y={
          props.style.y.to(
            (yVal: number) => Math.max(0, yVal - size / 1)
          ) as unknown as number
        }
        x={
          props.style.x.to(
            (xVal: number) => Math.max(size / 2, xVal - size / 2)
          ) as unknown as number
        }
        style={{ 
          pointerEvents: "auto", 
          overflow: "visible",
          // Ensure proper rendering in different contexts
          isolation: "isolate"
        }}
      >
        <div style={{ width: '100%', height: '100%' }}>
          <PrHoverCard
            pullRequest={props.node.data._pr}
            role={role?.role || (props.node.data._pr.user.type === "Bot" ? "Bot" : "Contributor")}
          >
            <Avatar
              className={`${
                isMobile ? "w-6 h-6" : "w-8 h-8"
              } border-2 border-background cursor-pointer`}
              style={{
                // Ensure the avatar renders properly in foreignObject
                backgroundColor: 'var(--muted)',
                borderColor: 'var(--background)'
              }}
            >
              <AvatarImage
                src={props.node.data.image}
                alt={props.node.data.contributor}
                loading="lazy"
                style={{
                  // Ensure images load properly in SVG context
                  objectFit: 'cover',
                  width: '100%',
                  height: '100%'
                }}
                crossOrigin="anonymous"
                onError={(e) => {
                  // Fallback to GitHub identicon on error, but only once
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.retried) {
                    target.dataset.retried = 'true';
                    target.src = `https://github.com/identicons/${props.node.data.contributor}.png`;
                  }
                }}
              />
              <AvatarFallback
                style={{
                  backgroundColor: 'var(--muted)',
                  color: 'var(--muted-foreground)',
                  fontSize: isMobile ? '10px' : '12px'
                }}
              >
                {props.node.data.contributor
                  ? props.node.data.contributor[0].toUpperCase()
                  : "?"}
              </AvatarFallback>
            </Avatar>
          </PrHoverCard>
        </div>
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

  // Show placeholder when repository is not tracked
  if (!isRepositoryTracked) {
    return (
      <div className={`${isMobile ? "h-[280px]" : "h-[400px]"} w-full flex items-center justify-center bg-muted/10 rounded-lg border-2 border-dashed border-muted-foreground/20`}>
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            Track this repository to see contribution analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full overflow-hidden">
        <div
          className={`flex flex-col gap-4 pt-3 ${
            isMobile ? "px-2" : "md:px-7"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {data[0].data.length} pull requests shown
            </div>
            
            {/* Status Filter Tabs */}
            <div className="flex-shrink-0">
              <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "open" | "merged" | "closed")}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="open" className="text-xs">Open</TabsTrigger>
                  <TabsTrigger value="merged" className="text-xs">Merged</TabsTrigger>
                  <TabsTrigger value="closed" className="text-xs">Closed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className={`flex flex-wrap gap-2 ${isMobile ? "w-full" : ""}`}>
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
        </div>
        <div className={`${isMobile ? "h-[280px]" : "h-[400px]"} w-full overflow-hidden relative`}>
          <ProgressiveChart
            skeleton={
              <SkeletonChart 
                variant="scatter" 
                height={isMobile ? "sm" : "lg"}
                showAxes={true}
              />
            }
            highFidelity={
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
                min: 1,
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
              theme={nivoTheme}
              isInteractive={true}
              axisLeft={{
                tickSize: 2,
                tickPadding: 3,
                tickRotation: 0,
                tickValues: isMobile ? 3 : 5,
                legend: isMobile ? "Lines" : "Lines Touched",
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
            }
            priority={false}
            highFiDelay={300}
            className="h-full w-full"
          />
        </div>
    </div>
  );
}

// Export ContributionsChart as default
export default ContributionsChart;
