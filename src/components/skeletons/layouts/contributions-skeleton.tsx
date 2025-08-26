import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SkeletonChart } from '../base/skeleton-chart';
import { cn } from '@/lib/utils';

interface ContributionsSkeletonProps {
  className?: string;
  isMobile?: boolean;
}

/**
 * ContributionsSkeleton component for displaying placeholder contributions chart
 *
 * @param className - Additional CSS classes to apply
 * @param isMobile - Whether to render mobile-optimized layout
 * @returns A skeleton layout for contributions chart with accessibility features
 */
export function ContributionsSkeleton({ className, isMobile = false }: ContributionsSkeletonProps) {
  return (
    <Card
      className={cn('animate-pulse skeleton-container skeleton-optimized', className)}
      aria-label="Loading contributions chart..."
      aria-busy="true"
    >
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-7 w-56" />
        </CardTitle>
        <div className="space-y-1">
          <CardDescription>
            <span className="inline-block h-4 w-80 animate-pulse rounded-md bg-primary/10" />
          </CardDescription>
          {isMobile && (
            <CardDescription>
              <span className="inline-block h-4 w-64 animate-pulse rounded-md bg-primary/10" />
            </CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent className={isMobile ? 'p-0' : 'p-6'}>
        <ContributionsChartSkeleton isMobile={isMobile} />
      </CardContent>
    </Card>
  );
}

/**
 * ContributionsChartSkeleton displays the chart area with optimized performance
 */
function ContributionsChartSkeleton({ isMobile }: { isMobile: boolean }) {
  // Pre-generate avatar positions to avoid Math.random() calls during render
  const avatarPositions = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        left: Math.random() * 70 + 15,
        top: Math.random() * 60 + 20,
        key: `avatar-${i}`,
      })),
    [],
  );

  return (
    <div className="space-y-4 w-full skeleton-container">
      {/* Controls and stats section */}
      <div
        className={cn(
          'flex flex-col items-start justify-between pt-3',
          isMobile ? 'px-6' : 'md:flex-row md:px-7',
        )}
        aria-label="Loading chart controls"
      >
        {/* Stats display */}
        <Skeleton className="h-5 w-32" />

        {/* Controls */}
        <div
          className={cn('flex flex-wrap gap-4 mt-3 md:mt-0', isMobile && 'w-full')}
          aria-label="Loading chart toggles"
        >
          {/* Show Bots Toggle */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Logarithmic Scale Toggle */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div
        className={cn('w-full', isMobile ? 'h-[300px]' : 'h-[400px]')}
        aria-label="Loading contributions chart"
      >
        <SkeletonChart
          height={isMobile ? 'md' : 'lg'}
          variant="scatter"
          showAxes={true}
          className="w-full h-full"
        />
      </div>

      {/* Chart loading indicators - scattered avatar placeholders */}
      <div className="relative -mt-80 pointer-events-none" aria-label="Loading contributor avatars">
        <div className={cn('absolute inset-0', isMobile ? 'mx-6' : 'mx-7')}>
          {avatarPositions.map((pos) => (
            <Skeleton
              key={pos.key}
              className={cn(
                'absolute rounded-full skeleton-optimized',
                isMobile ? 'w-7 h-7' : 'w-9 h-9',
              )}
              style={{
                left: `${pos.left}%`,
                top: `${pos.top}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
