import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HealthSkeletonProps {
  className?: string;
  isMobile?: boolean;
}

/**
 * HealthSkeleton component for displaying placeholder health analysis content
 * Matches the structure of RepositoryHealthCard component
 *
 * @param className - Additional CSS classes to apply
 * @param isMobile - Whether to render mobile-optimized layout
 * @returns A skeleton layout for health analysis with accessibility features
 */
export function HealthSkeleton({ className, isMobile = false }: HealthSkeletonProps) {
  return (
    <Card
      className={cn('animate-pulse skeleton-container skeleton-optimized', className)}
      aria-label="Loading repository health analysis..."
      aria-busy="true"
    >
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-7 w-48" />
        </CardTitle>
        <CardDescription>
          <span className="inline-block h-4 w-96 animate-pulse rounded-md bg-primary/10" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Top Row - Overall Health Score (full width) */}
          <OverallHealthSkeleton isMobile={isMobile} />

          {/* Bottom Row - Two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Lottery Factor */}
            <LotteryFactorSkeleton isMobile={isMobile} />

            {/* Right Column - Confidence, Health Factors, Self-Selection Rate */}
            <div className="space-y-6">
              <ContributorConfidenceSkeleton />
              <HealthFactorsSkeleton />
              <SelfSelectionRateSkeleton />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Overall Health Score skeleton (top row)
 */
function OverallHealthSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <Card className="skeleton-container">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Title and description */}
          <div className="text-center space-y-2">
            <Skeleton className="h-6 w-40 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>

          {/* Health score display */}
          <div className="flex justify-center items-center space-x-4">
            <div className="text-center">
              <Skeleton className="h-12 w-12 rounded-full mx-auto mb-2" />
              <Skeleton className="h-4 w-16 mx-auto" />
            </div>
          </div>

          {/* Health metrics row */}
          <div className={cn('grid gap-4 pt-4', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-8 mx-auto" />
                <Skeleton className="h-3 w-12 mx-auto" />
                <Skeleton className="h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Lottery Factor skeleton (left column)
 */
function LotteryFactorSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <Card className="skeleton-container">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Title and lottery factor score */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>

          {/* Chart placeholder */}
          <div
            className={cn(
              'w-full border-2 border-dashed border-muted rounded-lg flex items-center justify-center',
              isMobile ? 'h-48' : 'h-64'
            )}
          >
            <div className="text-center space-y-2">
              <Skeleton className="h-8 w-8 mx-auto" />
              <Skeleton className="h-4 w-24 mx-auto" />
            </div>
          </div>

          {/* Contributors list */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>

          {/* Bot toggle */}
          <div className="flex items-center space-x-2 pt-4 border-t">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Contributor Confidence skeleton
 */
function ContributorConfidenceSkeleton() {
  return (
    <Card className="skeleton-container">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Health Factors skeleton
 */
function HealthFactorsSkeleton() {
  return (
    <Card className="skeleton-container">
      <CardContent className="p-4">
        <div className="space-y-4">
          <Skeleton className="h-5 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Self-Selection Rate skeleton
 */
function SelfSelectionRateSkeleton() {
  return (
    <Card className="skeleton-container">
      <CardContent className="p-4">
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
