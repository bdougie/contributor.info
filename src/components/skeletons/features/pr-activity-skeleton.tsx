import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ActivityItemSkeleton } from '../components/activity-item-skeleton';
import { cn } from '@/lib/utils';

interface PRActivitySkeletonProps {
  className?: string;
  itemCount?: number;
  showFilters?: boolean;
  showLoadMore?: boolean;
}

export function PRActivitySkeleton({
  className,
  itemCount = 8,
  showFilters = true,
  showLoadMore = false,
}: PRActivitySkeletonProps) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-7 w-48" />
        </CardTitle>
        <CardDescription>
          <span className="inline-block h-4 w-72 animate-pulse rounded-md bg-primary/10" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showFilters && <FiltersSkeleton />}

        {/* Stats display */}
        <div className="text-sm text-muted-foreground">
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Activity Feed */}
        <ActivityFeedSkeleton itemCount={itemCount} />

        {/* Load More Button */}
        {showLoadMore && (
          <div className="flex justify-center pt-4">
            <Skeleton className="h-10 w-24" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-4 mb-4">
      {/* 5 main activity type filters */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-2">
          <Skeleton className="h-5 w-9 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}

      {/* Optional "Show Bots" filter */}
      <div className="flex items-center space-x-2">
        <Skeleton className="h-5 w-9 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

function ActivityFeedSkeleton({ itemCount }: { itemCount: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: itemCount }).map((_, i) => (
        <ActivityItemSkeleton key={i} />
      ))}
    </div>
  );
}
