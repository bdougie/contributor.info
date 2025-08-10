import { useState, useContext, useEffect, useRef, Suspense } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { humanizeNumber } from "@/lib/utils";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import { useTimeRange } from "@/lib/time-range-store";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { PullRequest } from "@/lib/types";
import { useTheme } from "@/components/common/theming/theme-provider";

// Custom shape component for avatar dots
interface CustomAvatarShapeProps {
  cx?: number;
  cy?: number;
  payload?: any;
  isMobile?: boolean;
}

const CustomAvatarShape: React.FC<CustomAvatarShapeProps> = ({ cx = 0, cy = 0, payload, isMobile = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const size = isMobile ? 28 : 35;
  const halfSize = size / 2;

  if (!payload || !payload._pr) {
    return null;
  }

  return (
    <g style={{ zIndex: isHovered ? 999 : 1 }}>
      <defs>
        <clipPath id={`avatar-clip-${payload._pr.id}`}>
          <circle cx={cx} cy={cy} r={halfSize} />
        </clipPath>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={halfSize}
        fill="transparent"
        stroke="transparent"
        strokeWidth="2"
        style={{
          cursor: 'pointer',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
          transformOrigin: `${cx}px ${cy}px`,
          transition: 'transform 0.2s ease-out'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      <circle
        cx={cx}
        cy={cy}
        r={halfSize}
        fill="var(--background)"
        stroke="var(--border)"
        strokeWidth="3"
        style={{
          pointerEvents: 'none',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
          transformOrigin: `${cx}px ${cy}px`,
          transition: 'transform 0.2s ease-out'
        }}
      />
      <image
        href={payload.image}
        x={cx - halfSize}
        y={cy - halfSize}
        width={size}
        height={size}
        clipPath={`url(#avatar-clip-${payload._pr.id})`}
        style={{ pointerEvents: 'none' }}
      />
      {!payload.image && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--muted-foreground)"
          fontSize={isMobile ? 10 : 12}
          style={{ pointerEvents: 'none' }}
        >
          {payload.contributor ? payload.contributor[0].toUpperCase() : "?"}
        </text>
      )}
    </g>
  );
};

// Custom tooltip component with PR details
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const pr = data._pr;
    
    if (!pr) return null;
    
    return (
      <div className="bg-popover text-popover-foreground border-2 border-border rounded-lg p-3 shadow-lg" style={{ 
        maxWidth: '320px',
        zIndex: 10000,
        position: 'relative',
        pointerEvents: 'none'
      }}>
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={pr.user.avatar_url} />
            <AvatarFallback>{pr.user.login[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold truncate">{pr.user.login}</p>
              {pr.user.type === "Bot" && (
                <Badge variant="secondary" className="text-xs">Bot</Badge>
              )}
            </div>
            <p className="text-sm font-medium line-clamp-2 mb-2">{pr.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>#{pr.number}</span>
              <span className={`inline-flex items-center ${
                pr.state === 'open' ? 'text-green-600' : 
                pr.merged_at ? 'text-purple-600' : 'text-red-600'
              }`}>
                {pr.state === 'open' ? '● Open' : 
                 pr.merged_at ? '✓ Merged' : '✗ Closed'}
              </span>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>+{pr.additions} -{pr.deletions}</span>
              <span>{pr.changed_files} files</span>
              <span>{data.x === 0 ? 'Today' : `${data.x} days ago`}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function ContributionsChartRecharts() {
  const { stats, includeBots: contextIncludeBots } = useContext(RepoStatsContext);
  const { effectiveTimeRange } = useTimeRange();
  
  // Add global styles for tooltip z-index
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .recharts-tooltip-wrapper {
        z-index: 10000 !important;
        position: relative !important;
      }
      .recharts-active-dot {
        z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const { theme } = useTheme();
  const [isLogarithmic, setIsLogarithmic] = useState(false);
  const [maxFilesModified, setMaxFilesModified] = useState(10);
  const [localIncludeBots, setLocalIncludeBots] = useState(contextIncludeBots);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "merged" | "closed">("all");
  const safeStats = stats || { pullRequests: [], loading: false, error: null };
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );
  const effectiveTimeRangeNumber = parseInt(effectiveTimeRange, 10);
  const mobileMaxDays = 7;
  const functionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get the actual theme (resolves 'system' to 'light' or 'dark')
  const getActualTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  const actualTheme = getActualTheme();
  const isDark = actualTheme === 'dark';

  // Theme configuration for Recharts
  const chartTheme = {
    grid: {
      stroke: isDark ? 'hsl(240 3.7% 15.9%)' : 'hsl(240 5.9% 90%)',
      strokeOpacity: 0.5,
    },
    axis: {
      stroke: isDark ? 'hsl(240 5% 64.9%)' : 'hsl(240 3.8% 46.1%)',
      tick: {
        fill: isDark ? 'hsl(240 5% 64.9%)' : 'hsl(240 3.8% 46.1%)',
        fontSize: 12,
      },
      label: {
        fill: isDark ? 'hsl(240 5% 64.9%)' : 'hsl(240 3.8% 46.1%)',
        fontSize: 12,
      }
    }
  };

  // Add resize listener
  useEffect(() => {
    const handleResize = () => {
      if (functionTimeout.current) {
        clearTimeout(functionTimeout.current);
      }
      functionTimeout.current = setTimeout(() => {
        setIsMobile(window.innerWidth < 768);
      }, 150);
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
    if (safeStats.pullRequests && safeStats.pullRequests.length > 0) {
      const maxLines = Math.max(
        ...safeStats.pullRequests.map((pr) => pr.additions + pr.deletions)
      );
      setMaxFilesModified(maxLines);
    }
  }, [safeStats.pullRequests]);

  useEffect(() => {
    setLocalIncludeBots(contextIncludeBots);
  }, [contextIncludeBots]);

  const getScatterData = () => {
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

        if (
          (isMobile && daysAgo > mobileMaxDays) ||
          (!isMobile && daysAgo > effectiveTimeRangeNumber)
        ) {
          return null;
        }

        const linesTouched = pr.additions + pr.deletions;
        return {
          x: daysAgo,
          y: Math.max(linesTouched, 1),
          contributor: pr.user.login,
          image: pr.user.avatar_url,
          _pr: pr,
        };
      })
      .filter(
        (item): item is {
          x: number;
          y: number;
          contributor: string;
          image: string;
          _pr: PullRequest;
        } => item !== null
      );

    return prData;
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
    }, 50);
  };

  const data = getScatterData();
  const botCount = safeStats.pullRequests.filter(
    (pr) => pr.user.type === "Bot"
  ).length;
  const hasBots = botCount > 0;

  // Format axis ticks
  const formatXAxisTick = (value: number) => {
    if (value === 0) return "Today";
    if (value > effectiveTimeRangeNumber) return `${effectiveTimeRangeNumber}+`;
    return isMobile ? `${value}` : `${value} days ago`;
  };

  const formatYAxisTick = (value: number) => {
    if (parseInt(`${value}`) >= 1000) {
      return humanizeNumber(value);
    }
    return `${value}`;
  };

  return (
    <div className="space-y-4 w-full overflow-hidden">
      <div className={`flex flex-col gap-4 pt-3 ${isMobile ? "px-2" : "md:px-7"}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {data.length} pull requests shown
          </div>
          
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
      
      <div 
        className={`${isMobile ? "h-[280px]" : "h-[400px]"} w-full relative`}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center h-full w-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        }>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{
                top: 20,
                right: isMobile ? 10 : 60,
                bottom: isMobile ? 45 : 70,
                left: isMobile ? 35 : 90,
              }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={chartTheme.grid.stroke}
                strokeOpacity={chartTheme.grid.strokeOpacity}
              />
              <XAxis 
                type="number"
                dataKey="x"
                domain={[0, isMobile ? mobileMaxDays : effectiveTimeRangeNumber]}
                reversed
                tickFormatter={formatXAxisTick}
                label={{ 
                  value: isMobile ? "Days Ago" : "Date Created", 
                  position: "insideBottom", 
                  offset: isMobile ? -35 : -50,
                  style: chartTheme.axis.label
                }}
                tick={chartTheme.axis.tick}
                stroke={chartTheme.axis.stroke}
              />
              <YAxis 
                type={isLogarithmic ? "number" : "number"}
                dataKey="y"
                domain={[1, Math.max(Math.round(maxFilesModified * 1.5), 10)]}
                scale={isLogarithmic ? "log" : "linear"}
                tickFormatter={formatYAxisTick}
                label={{ 
                  value: isMobile ? "Lines" : "Lines Touched", 
                  angle: -90, 
                  position: "insideLeft",
                  style: chartTheme.axis.label
                }}
                tick={chartTheme.axis.tick}
                stroke={chartTheme.axis.stroke}
              />
              <Tooltip 
                content={<CustomTooltip />}
                animationDuration={200}
                animationEasing="ease-out"
                wrapperStyle={{ 
                  zIndex: 10000
                }}
                cursor={false}
              />
              <Scatter 
                key={`scatter-${isLogarithmic}-${statusFilter}-${localIncludeBots}-${effectiveTimeRangeNumber}`}
                data={data} 
                fill="#8884d8"
                shape={(props: any) => <CustomAvatarShape {...props} isMobile={isMobile} />}
                isAnimationActive={true}
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </Suspense>
      </div>
    </div>
  );
}

export default ContributionsChartRecharts;