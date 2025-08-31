import { useMemo, lazy, Suspense } from 'react';
import type { ScatterPlotNodeProps } from '@nivo/scatterplot';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Sparkles, Users } from '@/components/ui/icon';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { RisingStarsData, RisingStarContributor } from '@/lib/analytics/rising-stars-data';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the heavy visualization component
const ResponsiveScatterPlot = lazy(() =>
  import('@nivo/scatterplot').then((module) => ({
    default: module.ResponsiveScatterPlot,
  }))
);

interface RisingStarsChartProps {
  data: RisingStarsData[];
  height?: number;
  maxBubbles?: number;
  className?: string;
}

type ChartDataPoint = {
  x: number;
  y: number;
  size: number;
  contributor: RisingStarContributor;
};

function CustomNode({ node, style }: ScatterPlotNodeProps<ChartDataPoint>) {
  const { contributor } = node.data;
  const x = typeof style.x === 'object' && 'get' in style.x ? style.x.get() : 0;
  const y = typeof style.y === 'object' && 'get' in style.y ? style.y.get() : 0;
  const size = node.size || 10;
  const radius = Math.sqrt(size) * 2;

  return (
    <g transform={`translate(${x}, ${y})`}>
      <HoverCard>
        <HoverCardTrigger asChild>
          <g className="cursor-pointer">
            {/* Outer ring for rising stars */}
            {contributor.isRisingStar && (
              <circle
                r={radius + 3}
                fill="none"
                stroke="url(#rising-star-gradient)"
                strokeWidth="2"
                className="animate-pulse"
              />
            )}

            {/* Background circle */}
            <circle
              r={radius}
              fill={contributor.isNewContributor ? '#10b981' : '#3b82f6'}
              fillOpacity={0.15}
              stroke={contributor.isNewContributor ? '#10b981' : '#3b82f6'}
              strokeWidth="2"
            />

            {/* Avatar clip path */}
            <defs>
              <clipPath id={`avatar-clip-${contributor.github_id}`}>
                <circle r={radius - 4} />
              </clipPath>
            </defs>

            {/* Avatar image */}
            <image
              href={contributor.avatar_url}
              x={-(radius - 4)}
              y={-(radius - 4)}
              width={(radius - 4) * 2}
              height={(radius - 4) * 2}
              clipPath={`url(#avatar-clip-${contributor.github_id})`}
            />

            {/* Activity indicator */}
            {contributor.velocityScore > 5 && (
              <circle
                r={6}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth="2"
                transform={`translate(${radius - 8}, ${-radius + 8})`}
              />
            )}
          </g>
        </HoverCardTrigger>

        <HoverCardContent className="w-80" align="center">
          <ContributorDetails contributor={contributor} />
        </HoverCardContent>
      </HoverCard>
    </g>
  );
}

function ContributorDetails({ contributor }: { contributor: RisingStarContributor }) {
  const contributionDays = Math.ceil(
    (new Date().getTime() - new Date(contributor.firstContributionDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={contributor.avatar_url} alt={contributor.login} />
            <AvatarFallback>{contributor.login.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h4 className="text-sm font-semibold">{contributor.login}</h4>
            <div className="flex gap-1 mt-1">
              {contributor.isRisingStar && (
                <Badge variant="default" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Rising Star
                </Badge>
              )}
              {contributor.isNewContributor && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  New
                </Badge>
              )}
            </div>
          </div>
        </div>
        {contributor.growthRate > 0 && (
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">+{contributor.growthRate.toFixed(0)}%</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center p-2 bg-muted rounded">
          <div className="font-semibold">{contributor.pullRequests}</div>
          <div className="text-xs text-muted-foreground">PRs</div>
        </div>
        <div className="text-center p-2 bg-muted rounded">
          <div className="font-semibold">{contributor.commits}</div>
          <div className="text-xs text-muted-foreground">Commits</div>
        </div>
        <div className="text-center p-2 bg-muted rounded">
          <div className="font-semibold">{contributor.issues}</div>
          <div className="text-xs text-muted-foreground">Issues</div>
        </div>
      </div>

      <div className="pt-2 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Velocity Score</span>
          <span className="font-medium">{contributor.velocityScore.toFixed(1)}/week</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Contributing for</span>
          <span className="font-medium">{contributionDays} days</span>
        </div>
      </div>
    </div>
  );
}

export function RisingStarsChart({
  data,
  height = 500,
  maxBubbles = 50,
  className,
}: RisingStarsChartProps) {
  const chartData = useMemo(() => {
    // Limit the number of bubbles displayed
    return data.map((series) => ({
      ...series,
      data: series.data.slice(0, maxBubbles),
    }));
  }, [data, maxBubbles]);

  const totalContributors = chartData[0]?.data.length || 0;
  const risingStars = chartData[0]?.data.filter((d) => d.contributor.isRisingStar).length || 0;
  const newContributors =
    chartData[0]?.data.filter((d) => d.contributor.isNewContributor).length || 0;

  // Define theme inline to ensure it's always available
  const nivoTheme = {
    background: 'transparent',
    animate: true,
    motionConfig: 'default',
    text: {
      fontSize: 12,
      fill: 'hsl(0 0% 3.9%)',
      outlineWidth: 0,
      outlineColor: 'transparent',
    },
    axis: {
      domain: {
        line: {
          stroke: 'hsl(0 0% 87%)',
          strokeWidth: 1,
        },
      },
      legend: {
        text: {
          fontSize: 13,
          fill: 'hsl(0 0% 45.1%)',
          outlineWidth: 0,
          outlineColor: 'transparent',
        },
      },
      ticks: {
        line: {
          stroke: 'hsl(0 0% 87%)',
          strokeWidth: 1,
        },
        text: {
          fontSize: 11,
          fill: 'hsl(0 0% 45.1%)',
          outlineWidth: 0,
          outlineColor: 'transparent',
        },
      },
    },
    grid: {
      line: {
        stroke: 'hsl(0 0% 87%)',
        strokeWidth: 1,
        strokeDasharray: '4 4',
      },
    },
    tooltip: {
      container: {
        background: 'hsl(0 0% 100%)',
        color: 'hsl(0 0% 3.9%)',
        fontSize: 12,
      },
    },
    annotations: {
      text: {
        fontSize: 13,
        fill: 'hsl(0 0% 3.9%)',
        outlineWidth: 2,
        outlineColor: 'hsl(0 0% 100%)',
        outlineOpacity: 1,
      },
      link: {
        stroke: 'hsl(0 0% 3.9%)',
        strokeWidth: 1,
        outlineWidth: 2,
        outlineColor: 'hsl(0 0% 100%)',
        outlineOpacity: 1,
      },
      outline: {
        stroke: 'hsl(0 0% 3.9%)',
        strokeWidth: 2,
        outlineWidth: 2,
        outlineColor: 'hsl(0 0% 100%)',
        outlineOpacity: 1,
      },
      symbol: {
        fill: 'hsl(0 0% 3.9%)',
        outlineWidth: 2,
        outlineColor: 'hsl(0 0% 100%)',
        outlineOpacity: 1,
      },
    },
  };

  // Empty data fallback
  if (!chartData[0]?.data?.length) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle>Rising Stars & Growing Contributors</CardTitle>
          <CardDescription>No contributor data available for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data to display
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ensure we have valid data and theme before rendering
  if (!nivoTheme || !nivoTheme.axis) {
    console.error('Theme not properly initialized');
    return null;
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Rising Stars & Growing Contributors</CardTitle>
            <CardDescription>
              Contributor velocity and engagement over the last 30 days
            </CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Active ({totalContributors - newContributors})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>New ({newContributors})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-orange-500" />
              <span>Rising ({risingStars})</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          {chartData && chartData.length > 0 && (
            <Suspense fallback={<Skeleton className="w-full h-full" />}>
              <ResponsiveScatterPlot
                data={chartData}
                margin={{ top: 20, right: 20, bottom: 70, left: 70 }}
                xScale={{ type: 'linear', min: 0, max: 'auto' }}
                yScale={{ type: 'linear', min: 0, max: 'auto' }}
                blendMode="normal"
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'Commits',
                  legendPosition: 'middle',
                  legendOffset: 46,
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 5,
                  tickRotation: 0,
                  legend: 'Pull Requests + Issues',
                  legendPosition: 'middle',
                  legendOffset: -50,
                }}
                colors={{ scheme: 'category10' }}
                nodeSize={(d) => {
                  const datum = d as { data?: { size?: number } };
                  return datum.data?.size || 10;
                }}
                nodeComponent={
                  CustomNode as React.ComponentType<ScatterPlotNodeProps<ChartDataPoint>>
                }
                useMesh={false}
                gridXValues={5}
                gridYValues={5}
                theme={nivoTheme}
                animate={true}
                motionConfig="gentle"
              />
            </Suspense>
          )}

          {/* Gradient definition for rising stars */}
          <svg width="0" height="0">
            <defs>
              <linearGradient id="rising-star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
