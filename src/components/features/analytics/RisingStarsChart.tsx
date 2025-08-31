import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Sparkles, Users } from '@/components/ui/icon';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import type { RisingStarsData, RisingStarContributor } from '@/lib/analytics/rising-stars-data';
import { cn } from '@/lib/utils';
import { ChartErrorBoundary } from './ChartErrorBoundary';

interface RisingStarsChartProps {
  data: RisingStarsData[];
  height?: number;
  maxBubbles?: number;
  className?: string;
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
          <span className="text-muted-foreground">Activity Score</span>
          <span className="font-medium">{contributor.totalActivity}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Velocity</span>
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
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showHoverCard, setShowHoverCard] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  // Calculate bounds for the chart
  const xMax = Math.max(...(chartData[0]?.data.map((d) => d.x) || [100]));
  const yMax = Math.max(...(chartData[0]?.data.map((d) => d.y) || [100]));

  // Keyboard navigation handlers
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const dataPoints = chartData[0]?.data || [];
      const currentIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % dataPoints.length);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + dataPoints.length) % dataPoints.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (currentIndex >= 0 && currentIndex < dataPoints.length) {
            setShowHoverCard(showHoverCard === currentIndex ? null : currentIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowHoverCard(null);
          setFocusedIndex(-1);
          break;
        case 'Tab':
          // Allow normal tab navigation but reset focus
          setFocusedIndex(-1);
          setShowHoverCard(null);
          break;
      }
    },
    [chartData, focusedIndex, showHoverCard]
  );

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && bubbleRefs.current.has(focusedIndex)) {
      bubbleRefs.current.get(focusedIndex)?.focus();
    }
  }, [focusedIndex]);

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
        <div
          ref={chartRef}
          className="relative border rounded-lg bg-muted/10"
          style={{ height }}
          role="img"
          aria-label="Rising Stars activity chart showing contributors plotted by code and non-code contributions"
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* Axes labels */}
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground"
            aria-label="X axis: Code Contributions"
          >
            Code Contributions (PRs + Commits) →
          </div>
          <div
            className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground"
            aria-label="Y axis: Non-Code Contributions"
          >
            Non-Code Contributions →
          </div>

          {/* Grid lines */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute left-1/4 top-0 bottom-0 border-l border-dashed border-muted" />
            <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-muted" />
            <div className="absolute left-3/4 top-0 bottom-0 border-l border-dashed border-muted" />
            <div className="absolute top-1/4 left-0 right-0 border-t border-dashed border-muted" />
            <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-muted" />
            <div className="absolute top-3/4 left-0 right-0 border-t border-dashed border-muted" />
          </div>

          {/* Plot area */}
          <div className="absolute inset-8">
            {chartData[0].data.map((point, i) => {
              const { contributor } = point;
              // Calculate position as percentage
              const xPercent = (point.x / xMax) * 100;
              const yPercent = 100 - (point.y / yMax) * 100; // Invert Y axis
              const size = Math.min(Math.max(point.size / 2, 20), 60); // Scale size

              return (
                <div
                  key={`${contributor.github_id}-${i}`}
                  className="absolute"
                  style={{
                    left: `${xPercent}%`,
                    top: `${yPercent}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: i, // Layer bubbles based on their order
                  }}
                >
                  <HoverCard open={showHoverCard === i}>
                    <HoverCardTrigger asChild>
                      <div
                        ref={(el) => {
                          if (el) bubbleRefs.current.set(i, el);
                        }}
                        className={cn(
                          'relative cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full',
                          focusedIndex === i && 'ring-2 ring-primary ring-offset-2'
                        )}
                        role="button"
                        aria-label={`Contributor ${contributor.login} with ${contributor.totalActivity} total activity`}
                        tabIndex={focusedIndex === i ? 0 : -1}
                        onClick={() => setShowHoverCard(showHoverCard === i ? null : i)}
                      >
                        {/* Rising star indicator */}
                        {contributor.isRisingStar && (
                          <div
                            className="absolute rounded-full border-2 border-orange-500 animate-pulse"
                            style={{
                              width: size + 6,
                              height: size + 6,
                              left: -3,
                              top: -3,
                            }}
                          />
                        )}

                        {/* Avatar bubble */}
                        <div
                          className={cn(
                            'rounded-full border-2 overflow-hidden transition-transform hover:scale-110',
                            contributor.isNewContributor ? 'border-green-500' : 'border-blue-500'
                          )}
                          style={{
                            width: size,
                            height: size,
                          }}
                        >
                          <Avatar className="w-full h-full">
                            <AvatarImage src={contributor.avatar_url} alt={contributor.login} />
                            <AvatarFallback className="text-xs">
                              {contributor.login.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        {/* Activity indicator */}
                        {contributor.velocityScore > 5 && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background" />
                        )}
                      </div>
                    </HoverCardTrigger>

                    <HoverCardPrimitive.Portal>
                      <HoverCardContent className="w-80 !z-[9999]" align="center" sideOffset={5}>
                        <ContributorDetails contributor={contributor} />
                      </HoverCardContent>
                    </HoverCardPrimitive.Portal>
                  </HoverCard>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * RisingStarsChart wrapped with error boundary for production use
 */
export function RisingStarsChartWithErrorBoundary(props: RisingStarsChartProps) {
  return (
    <ChartErrorBoundary
      fallbackTitle="Rising Stars Chart Unavailable"
      fallbackDescription="Unable to display the rising stars visualization at this time."
    >
      <RisingStarsChart {...props} />
    </ChartErrorBoundary>
  );
}
