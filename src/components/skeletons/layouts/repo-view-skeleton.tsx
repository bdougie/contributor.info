import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RepoViewSkeletonProps {
  className?: string;
}

/**
 * RepoViewSkeleton component for displaying placeholder layout for repository view pages
 * 
 * @param className - Additional CSS classes to apply
 * @returns A skeleton layout with search bar and main content areas
 */
export function RepoViewSkeleton({ className }: RepoViewSkeletonProps) {
  return (
    <div 
      className={cn("container mx-auto py-2 skeleton-container", className)}
      aria-label="Loading repository view..."
      aria-busy="true"
    >
      {/* Search Bar Section */}
      <Card className="mb-8 animate-pulse skeleton-optimized" aria-label="Loading search bar">
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4">
            <Skeleton className="flex-1 h-10" />
            <Skeleton className="w-24 h-10" />
          </div>
          {/* Example repos skeleton */}
          <div className="flex flex-wrap gap-2" aria-label="Loading example repositories">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`example-repo-${i}`} className="h-6 w-24" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Section */}
      <div className="grid gap-8" aria-label="Loading main content">
        <Card className="animate-pulse skeleton-optimized">
          <CardHeader aria-label="Loading repository header">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                {/* Repository name */}
                <Skeleton className="h-8 w-64" />
                {/* Description */}
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tabs skeleton */}
            <div className="space-y-4">
              <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground grid grid-cols-4 w-full max-w-md" aria-label="Loading navigation tabs">
                <Skeleton className="h-7 rounded-md mx-1" />
                <Skeleton className="h-7 rounded-md mx-1" />
                <Skeleton className="h-7 rounded-md mx-1" />
                <Skeleton className="h-7 rounded-md mx-1" />
              </div>
            </div>

            {/* Content area placeholder */}
            <div className="mt-6">
              <ContentAreaSkeleton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Default content area skeleton - feed-style layout that matches actual content structure
 * @returns A skeleton layout with stacked feed-style cards
 */
function ContentAreaSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-label="Loading content area">
      <div className="text-center text-muted-foreground">
        Loading repository data...
      </div>
      {/* Feed-style skeleton to match expected content */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 skeleton-optimized">
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}