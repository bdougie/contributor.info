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
              <div className="flex space-x-1 bg-muted p-1 rounded-md w-fit" aria-label="Loading navigation tabs">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
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
 * Default content area skeleton - can be overridden by specific page skeletons
 * @returns A skeleton layout with main content card and secondary content grid
 */
function ContentAreaSkeleton() {
  return (
    <div className="space-y-6 animate-pulse skeleton-container" aria-label="Loading content area">
      {/* Main content card */}
      <Card aria-label="Loading main content card" className="skeleton-optimized">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-3 gap-4" aria-label="Loading statistics grid">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>

      {/* Secondary content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-label="Loading secondary content">
        <Card aria-label="Loading chart content" className="skeleton-optimized">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
        <Card aria-label="Loading additional content" className="skeleton-optimized">
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}