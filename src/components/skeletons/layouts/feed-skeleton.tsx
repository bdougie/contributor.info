import { Skeleton } from "@/components/ui/skeleton";
import { PRActivitySkeleton } from "../features/pr-activity-skeleton";

export function FeedSkeleton() {
  return (
    <div className="container mx-auto py-2 space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* PR Activity Feed Skeleton */}
      <PRActivitySkeleton 
        itemCount={10}
        showFilters={true}
        showLoadMore={true}
      />
    </div>
  );
}