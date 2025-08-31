import { useMemo, lazy, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RisingStarsData } from '@/lib/analytics/rising-stars-data';
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
              Contributor activity mapping: Commits (X-axis) vs Total GitHub Events (Y-axis)
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
                  legend: 'Total GitHub Events (PRs, Issues, Comments, Reviews, Discussions)',
                  legendPosition: 'middle',
                  legendOffset: -50,
                }}
                colors={{ scheme: 'category10' }}
                nodeSize={(d) => {
                  const datum = d as { data?: { size?: number } };
                  return datum.data?.size || 10;
                }}
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
